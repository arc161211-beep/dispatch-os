import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { requireAdmin, requireOrg } from "./lib/context";
import { validEmail } from "./lib/validation";
import { ACCOUNT_STATUSES, ROLES, Role } from "./constants";
import { checkRateLimit, INVITE_LIMIT, PROVISION_LIMIT } from "./lib/rateLimit";

/** Invitation token expiry: 7 days */
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user;
  },
});

export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
};

/**
 * One-time workspace provisioning. Called by the app shell after sign-in.
 * - If a pending invite exists for this email, the user joins that org with
 *   the invited role, carrier assignment, and name/phone.
 * - Otherwise a brand-new organization is created and the user becomes ADMIN.
 * Safe to call repeatedly — it is a no-op once the user has an org.
 *
 * SECURITY: Only allows provisioning if:
 * 1. User has a matching pending invite (not expired/revoked), OR
 * 2. This is genuinely a brand-new workspace (no other users exist yet)
 */
export const provision = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not signed in.");
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User record not found.");

    if (user.orgId) {
      // Stamp last login time for admin visibility.
      await ctx.db.patch(userId, { lastLoginAt: Date.now() });
      return { status: "ready" as const };
    }

    // Rate limit: prevent repeated provisioning attempts
    const rateLimitKey = `provision:${userId}`;
    const rateCheck = checkRateLimit(rateLimitKey, PROVISION_LIMIT.maxAttempts, PROVISION_LIMIT.windowMs);
    if (!rateCheck.allowed) {
      throw new ConvexError(`Too many attempts. Please try again in ${Math.ceil(rateCheck.retryAfterMs / 60000)} minutes.`);
    }

    const email = user.email?.toLowerCase().trim();

    // 1) Pending invite path — user joins an existing organization.
    if (email) {
      const pending = await ctx.db
        .query("pendingUsers")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (pending && pending.status === "pending") {
        // Check if invitation has expired
        if (pending.expiresAt && pending.expiresAt < Date.now()) {
          throw new ConvexError("This invitation has expired. Please ask an administrator to send a new one.");
        }

        const orgId: Id<"organizations"> = pending.orgId;
        await ctx.db.patch(pending._id, { status: "accepted" });
        await ctx.db.patch(userId, {
          orgId,
          role: pending.role as Role,
          name: user.name ?? pending.name ?? pending.email,
          phone: pending.phone,
          carrierId: pending.carrierId as Id<"carriers"> | undefined,
          driverId: pending.driverId as Id<"drivers"> | undefined,
          accountStatus: "active",
          lastLoginAt: Date.now(),
        });
        await audit(ctx, null, {
          orgId,
          actorId: userId,
          actorName: user.name ?? email,
          action: "user.invite.accepted",
          entity: "user",
          entityId: userId,
          metadata: { email, role: pending.role, carrierId: pending.carrierId },
        });
        return { status: "ready" as const, inviteAccepted: true };
      }
    }

    // 2) New organization path — only allowed if no org exists yet (first user).
    // SECURITY: In a private platform, new orgs should only be created by
    // the first user. Subsequent users must be invited.
    const allUsers = await ctx.db.query("users").collect();
    const anyWithOrg = allUsers.filter((u) => u.orgId);
    if (anyWithOrg.length > 0) {
      // There are already provisioned users — new signup is not allowed.
      throw new ConvexError(
        "This is a private platform. You must be invited by an administrator to gain access.",
      );
    }

    const orgName = user.name ? `${user.name.split(" ")[0]}'s Dispatch` : "My Dispatch Company";
    const orgId: Id<"organizations"> = await ctx.db.insert("organizations", {
      name: orgName,
      contactEmail: email ?? undefined,
    });

    await ctx.db.insert("settings", {
      orgId,
      timezone: "America/Chicago",
      currency: "USD",
      feeDefaults: { feeType: "percentage", feeRatePercent: 7 },
      notificationPrefs: {},
    });

    await ctx.db.patch(userId, {
      orgId,
      role: "admin",
      name: user.name ?? orgName,
      accountStatus: "active",
      lastLoginAt: Date.now(),
    });

    await audit(ctx, null, {
      orgId,
      actorId: userId,
      actorName: user.name ?? email,
      action: "organization.created",
      entity: "organization",
      entityId: orgId,
    });
    await audit(ctx, null, {
      orgId,
      actorId: userId,
      actorName: user.name ?? email,
      action: "user.created",
      entity: "user",
      entityId: userId,
      metadata: { email, role: "admin" },
    });

    return { status: "created" as const };
  },
});

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------

/** Get all org users with full details for admin management. */
export const getOrgUsers = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const members = users
      .filter((u) => u.orgId === s.orgId && !u.isAnonymous)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "",
        email: u.email ?? "",
        role: (u.role ?? "read_only") as Role,
        disabled: !!u.disabled,
        accountStatus: (u.accountStatus as string) ?? "active",
        carrierId: u.carrierId ?? undefined,
        driverId: u.driverId ?? undefined,
        phone: u.phone ?? "",
        title: u.title ?? "",
        lastLoginAt: u.lastLoginAt ?? 0,
        createdAt: u._creationTime ?? 0,
      }));
    const pending = await ctx.db
      .query("pendingUsers")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .collect();
    return {
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
      pending: pending.map((p) => ({
        _id: p._id,
        email: p.email,
        name: p.name ?? "",
        phone: p.phone ?? "",
        role: p.role as Role,
        carrierId: p.carrierId ?? undefined,
        driverId: p.driverId ?? undefined,
        status: p.status,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
        isExpired: p.expiresAt < Date.now(),
      })),
    };
  },
});

/** Admin creates a user directly (creates pending invite with carrier/driver assignment). */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(...ROLES.map((r) => v.literal(r))),
    carrierId: v.optional(v.id("carriers")),
    driverId: v.optional(v.id("drivers")),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const email = validEmail(args.email);
    if (!email) throw new ConvexError("A valid email is required.");
    if (!args.name.trim()) throw new ConvexError("Name is required.");

    // Rate limit: prevent invitation spam
    const rateCheck = checkRateLimit(`invite:${s.userId}`, INVITE_LIMIT.maxAttempts, INVITE_LIMIT.windowMs);
    if (!rateCheck.allowed) {
      throw new ConvexError(`Too many invitations. Please try again in ${Math.ceil(rateCheck.retryAfterMs / 60000)} minutes.`);
    }

    // Check if email already has a pending invite
    const existingInvite = await ctx.db
      .query("pendingUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingInvite && existingInvite.status === "pending") {
      throw new ConvexError("An invitation for this email already exists.");
    }

    // Validate carrier exists if provided
    if (args.carrierId) {
      const carrier = await ctx.db.get(args.carrierId);
      if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    }

    const id = await ctx.db.insert("pendingUsers", {
      email,
      orgId: s.orgId as never,
      role: args.role,
      invitedBy: s.userId as never,
      carrierId: args.carrierId as Id<"carriers"> | undefined,
      driverId: args.driverId as Id<"drivers"> | undefined,
      name: args.name.trim(),
      phone: args.phone,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + INVITE_EXPIRY_MS,
    });

    await audit(ctx, s, {
      action: "user.created",
      entity: "user",
      entityId: id,
      metadata: {
        email,
        name: args.name,
        role: args.role,
        carrierId: args.carrierId,
        method: "admin_created",
      },
    });

    return { id };
  },
});

/** Admin invites a user by email. Stores carrierId, name, phone for provisioning. */
export const inviteUser = mutation({
  args: {
    email: v.string(),
    role: v.union(...ROLES.map((r) => v.literal(r))),
    name: v.optional(v.string()),
    carrierId: v.optional(v.id("carriers")),
    driverId: v.optional(v.id("drivers")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const email = validEmail(args.email);
    if (!email) throw new ConvexError("A valid email is required.");

    // Rate limit: prevent invitation spam
    const rateCheck = checkRateLimit(`invite:${s.userId}`, INVITE_LIMIT.maxAttempts, INVITE_LIMIT.windowMs);
    if (!rateCheck.allowed) {
      throw new ConvexError(`Too many invitations. Please try again in ${Math.ceil(rateCheck.retryAfterMs / 60000)} minutes.`);
    }

    // Check for existing invite (pending or accepted)
    const existing = await ctx.db
      .query("pendingUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing && existing.status === "pending" && existing.expiresAt > Date.now()) {
      throw new ConvexError("An active invitation for this email already exists.");
    }

    // Validate carrier exists if provided
    if (args.carrierId) {
      const carrier = await ctx.db.get(args.carrierId);
      if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    }

    const id = await ctx.db.insert("pendingUsers", {
      email,
      orgId: s.orgId as never,
      role: args.role,
      invitedBy: s.userId as never,
      carrierId: args.carrierId as Id<"carriers"> | undefined,
      driverId: args.driverId as Id<"drivers"> | undefined,
      name: args.name,
      phone: args.phone,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + INVITE_EXPIRY_MS,
    });

    await audit(ctx, s, {
      action: "user.invited",
      entity: "user",
      entityId: id,
      metadata: { email, role: args.role, name: args.name, carrierId: args.carrierId, driverId: args.driverId },
    });

    return { id };
  },
});

/** Revoke a pending invitation. */
export const revokeInvite = mutation({
  args: { id: v.id("pendingUsers") },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const invite = await ctx.db.get(args.id);
    if (!invite || invite.orgId !== s.orgId) throw new ConvexError("Invitation not found.");
    await ctx.db.patch(args.id, { status: "revoked" });
    await audit(ctx, s, { action: "user.invite.revoked", entity: "user", entityId: args.id, metadata: { email: invite.email } });
    return { ok: true };
  },
});

/** Admin changes a user's role. */
export const updateUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(...ROLES.map((r) => v.literal(r))) },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    if (args.userId === s.userId) throw new ConvexError("You cannot change your own role.");
    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== s.orgId) throw new ConvexError("User not found in this workspace.");
    if (target.role === "super_admin" && s.role !== "super_admin") throw new ConvexError("You cannot modify a super admin.");
    await ctx.db.patch(args.userId, { role: args.role });
    await audit(ctx, s, {
      action: "user.role.changed",
      entity: "user",
      entityId: args.userId,
      metadata: { from: target.role, to: args.role, email: target.email },
    });
    return { ok: true };
  },
});

/** Admin toggles a user's disabled status. */
export const setUserDisabled = mutation({
  args: { userId: v.id("users"), disabled: v.boolean() },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    if (args.userId === s.userId) throw new ConvexError("You cannot disable your own account.");
    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== s.orgId) throw new ConvexError("User not found in this workspace.");
    await ctx.db.patch(args.userId, { disabled: args.disabled });
    await audit(ctx, s, {
      action: args.disabled ? "user.disabled" : "user.enabled",
      entity: "user",
      entityId: args.userId,
      metadata: { email: target.email },
    });
    return { ok: true };
  },
});

/** Admin changes a user's account status (active, suspended, revoked). */
export const setAccountStatus = mutation({
  args: {
    userId: v.id("users"),
    accountStatus: v.union(
      ...ACCOUNT_STATUSES.map((s) => v.literal(s)),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    if (args.userId === s.userId) throw new ConvexError("You cannot change your own account status.");
    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== s.orgId) throw new ConvexError("User not found in this workspace.");
    if (target.role === "super_admin" && s.role !== "super_admin") throw new ConvexError("You cannot modify a super admin.");

    const previousStatus = target.accountStatus ?? "active";
    await ctx.db.patch(args.userId, { accountStatus: args.accountStatus });

    await audit(ctx, s, {
      action: "user.account_status.changed",
      entity: "user",
      entityId: args.userId,
      metadata: {
        from: previousStatus,
        to: args.accountStatus,
        email: target.email,
      },
    });

    return { ok: true };
  },
});

/** Admin assigns a carrier to a user (for carrier_admin / driver roles). */
export const assignCarrier = mutation({
  args: {
    userId: v.id("users"),
    carrierId: v.optional(v.id("carriers")),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== s.orgId) throw new ConvexError("User not found in this workspace.");

    if (args.carrierId) {
      const carrier = await ctx.db.get(args.carrierId);
      if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    }

    await ctx.db.patch(args.userId, { carrierId: args.carrierId as Id<"carriers"> | undefined });
    await audit(ctx, s, {
      action: "user.carrier.assigned",
      entity: "user",
      entityId: args.userId,
      metadata: {
        carrierId: args.carrierId,
        email: target.email,
      },
    });

    return { ok: true };
  },
});

/** Admin updates a user's profile info (name, phone, title). */
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== s.orgId) throw new ConvexError("User not found in this workspace.");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.title !== undefined) patch.title = args.title;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.userId, patch as never);
      await audit(ctx, s, {
        action: "user.profile.updated",
        entity: "user",
        entityId: args.userId,
        metadata: { fields: Object.keys(patch), email: target.email },
      });
    }

    return { ok: true };
  },
});

/** Get user count by role for admin overview. */
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const orgUsers = users.filter((u) => u.orgId === s.orgId && !u.isAnonymous);
    const byRole: Record<string, number> = {};
    for (const u of orgUsers) {
      const role = (u.role ?? "read_only") as string;
      byRole[role] = (byRole[role] ?? 0) + 1;
    }
    return {
      total: orgUsers.length,
      active: orgUsers.filter((u) => (u.accountStatus ?? "active") === "active").length,
      suspended: orgUsers.filter((u) => u.accountStatus === "suspended").length,
      revoked: orgUsers.filter((u) => u.accountStatus === "revoked").length,
      pending: (
        await ctx.db
          .query("pendingUsers")
          .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
          .collect()
      ).filter((p) => p.status === "pending").length,
      byRole,
    };
  },
});
