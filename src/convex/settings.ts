import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireAdmin, requireOrg } from "./lib/context";
import { CARRIER_FINANCIAL_VISIBILITY, FEE_TYPES, FeeType } from "./constants";
import { optString } from "./lib/validation";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const [settings, org] = await Promise.all([
      ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first(),
      ctx.db.get(s.orgId as never),
    ]);
    return { settings, org };
  },
});

export const update = mutation({
  args: {
    companyName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    businessHours: v.optional(v.string()),
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    feeDefaults: v.optional(
      v.object({
        feeType: v.union(...FEE_TYPES.map((f) => v.literal(f))),
        feeRatePercent: v.optional(v.number()),
        feeMinCents: v.optional(v.number()),
        feeMaxCents: v.optional(v.number()),
        flatFeeCents: v.optional(v.number()),
      }),
    ),
    notificationPrefs: v.optional(
      v.object({
        urgentOnlyDuringQuiet: v.optional(v.boolean()),
        emailDailyDigest: v.optional(v.boolean()),
        smsUrgent: v.optional(v.boolean()),
        push: v.optional(v.boolean()),
      }),
    ),
    carrierFinancialVisibility: v.optional(
      v.union(...CARRIER_FINANCIAL_VISIBILITY.map((v2) => v.literal(v2))),
    ),
    dataRetention: v.optional(
      v.object({
        locationHistoryDays: v.optional(v.number()),
        messageRetentionDays: v.optional(v.number()),
        auditLogRetentionDays: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    if (!settings) throw new ConvexError("Workspace settings not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(settings._id, patch as never);
    if (args.companyName !== undefined) {
      await ctx.db.patch(s.orgId as never, { name: optString(args.companyName, 120) ?? "My Dispatch Company" });
    }
    await audit(ctx, s, { action: "settings.updated", entity: "settings", entityId: settings._id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Per-user notification preferences
// ---------------------------------------------------------------------------

export const getUserNotificationPrefs = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const row = await ctx.db
      .query("userNotificationPrefs")
      .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
      .first();
    return row?.prefs ?? null;
  },
});

export const updateUserNotificationPrefs = mutation({
  args: {
    urgent: v.optional(v.boolean()),
    loads: v.optional(v.boolean()),
    documents: v.optional(v.boolean()),
    messages: v.optional(v.boolean()),
    tasks: v.optional(v.boolean()),
    finance: v.optional(v.boolean()),
    location: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const existing = await ctx.db
      .query("userNotificationPrefs")
      .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
      .first();

    const prefs = {
      urgent: args.urgent ?? true,
      loads: args.loads ?? true,
      documents: args.documents ?? true,
      messages: args.messages ?? true,
      tasks: args.tasks ?? true,
      finance: args.finance ?? true,
      location: args.location ?? true,
    };

    if (existing) {
      await ctx.db.patch(existing._id, { prefs, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("userNotificationPrefs", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        prefs,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Integration status — safe boolean check of server-side env vars only.
// Never exposes secret values to the client.
// ---------------------------------------------------------------------------

export const integrationStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireOrg(ctx);
    return {
      aiConfigured: !!process.env.NVIDIA_API_KEY,
      emailConfigured: !!process.env.RESEND_API_KEY,
    };
  },
});

export type { FeeType };
