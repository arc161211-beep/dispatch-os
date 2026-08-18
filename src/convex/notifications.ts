import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { requireOrg } from "./lib/context";
import type { Session } from "./lib/context";

/** Shared helper so other modules can create in-app notifications. */
export async function notify(
  ctx: MutationCtx,
  s: Session,
  n: { title: string; body?: string; link?: string; type?: string },
) {
  await ctx.db.insert("notifications", {
    orgId: s.orgId as never,
    userId: s.userId as never,
    title: n.title,
    body: n.body,
    link: n.link,
    type: n.type,
  });
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
      .order("desc")
      .take(args.limit ?? 100);
    return items;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
      .order("desc")
      .take(200);
    return items.filter((n) => !n.readAt).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const n = await ctx.db.get(args.id);
    if (!n || n.orgId !== s.orgId || n.userId !== s.userId) throw new Error("Notification not found.");
    if (!n.readAt) await ctx.db.patch(args.id, { readAt: Date.now() });
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const items = await ctx.db.query("notifications").withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId)).collect();
    for (const n of items) {
      if (!n.readAt) await ctx.db.patch(n._id, { readAt: Date.now() });
    }
    return { ok: true };
  },
});
