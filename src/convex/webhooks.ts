import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrg } from "./lib/context";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    return ctx.db.query("webhooks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).order("desc").take(args.limit ?? 100);
  },
});

/**
 * Record an incoming webhook. Signature verification happens in the HTTP
 * handler before this is called (see http.ts). Duplicate protection: an
 * externalId already processed is ignored.
 */
export const logWebhook = mutation({
  args: {
    provider: v.string(),
    eventType: v.optional(v.string()),
    externalId: v.optional(v.string()),
    payloadMeta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    if (args.externalId) {
      const existing = await ctx.db.query("webhooks").withIndex("by_org_provider", (q) =>
        q.eq("orgId", s.orgId).eq("provider", args.provider),
      ).collect();
      if (existing.some((w) => w.externalId === args.externalId && w.status === "processed")) {
        return { duplicated: true };
      }
    }
    await ctx.db.insert("webhooks", {
      orgId: s.orgId as never,
      provider: args.provider,
      eventType: args.eventType,
      externalId: args.externalId,
      payloadMeta: args.payloadMeta ? JSON.parse(JSON.stringify(args.payloadMeta).slice(0, 4000)) : undefined,
      status: args.externalId ? "processed" : "unverified",
      retryCount: 0,
      receivedAt: Date.now(),
      processedAt: Date.now(),
    });
    return { duplicated: false };
  },
});
