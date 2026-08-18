import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { requireAdmin } from "./lib/context";
import { validEmail } from "./lib/validation";
import { ROLES, Role } from "./constants";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
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
 *   the invited role.
 * - Otherwise a brand-new organization is created and the user becomes ADMIN.
 * Safe to call repeatedly — it is a no-op once the user has an org.
 */
export const provision = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not signed in.");
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User record not found.");

    if (user.orgId) return { status: "ready" as const };

    const email = user.email?.toLowerCase().trim();
    const role: Role = "admin";

    // 1) Pending invite path — user joins an existing organization.
    if (email) {
      const pending = await ctx.db
        .query("pendingUsers")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (pending && pending.status === "pending") {
        const orgId: Id<"organizations"> = pending.orgId;
        await ctx.db.patch(pending._id, { status: "accepted" });
        await ctx.db.patch(userId, {
          orgId,
          role: pending.role as Role,
          name: user.name ?? pending.email,
        });
        await audit(ctx, null, {
          orgId,
          actorId: userId,
          actorName: user.name ?? email,
          action: "user.invite.accepted",
          entity: "user",
          entityId: userId,
          metadata: { email, role: pending.role },
        });
        return { status: "ready" as const, inviteAccepted: true };
      }
    }

    // 2) New organization path.
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

    await ctx.db.patch(userId, { orgId, role: "admin", name: user.name ?? orgName });

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
        createdAt: (u._creationTime ?? 0),
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
        role: p.role as Role,
        status: p.status,
        createdAt: p.createdAt,
      })),
    };
  },
});

export const inviteUser = mutation({
  args: { email: v.string(), role: v.union(...ROLES.map((r) => v.literal(r))) },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const email = validEmail(args.email);
    if (!email) throw new ConvexError("A valid email is required.");
    const existing = await ctx.db
      .query("pendingUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new ConvexError("An invitation for this email already exists.");
    const id = await ctx.db.insert("pendingUsers", {
      email,
      orgId: s.orgId as never,
      role: args.role,
      invitedBy: s.userId as never,
      status: "pending",
      createdAt: Date.now(),
    });
    await audit(ctx, s, {
      action: "user.invited",
      entity: "user",
      entityId: id,
      metadata: { email, role: args.role },
    });
    return { id };
  },
});

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

