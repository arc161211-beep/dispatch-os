import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { requireOrg } from "./lib/context";
import type { Session } from "./lib/context";

/** Shared helper so other modules can create in-app notifications.
 * Checks user notification preferences and quiet hours before inserting.
 * type param maps to preference categories: urgent, loads, documents, messages, tasks, finance, location
 */
export async function notify(
  ctx: MutationCtx,
  s: Session,
  n: { title: string; body?: string; link?: string; type?: string },
) {
  // Check user notification preferences
  const prefRow = await ctx.db
    .query("userNotificationPrefs")
    .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
    .first();

  if (prefRow) {
    const cat = n.type ?? "urgent";
    const prefs = prefRow.prefs;
    // Map notification type to preference category
    const categoryMap: Record<string, keyof typeof prefs> = {
      urgent: "urgent",
      load: "loads",
      loads: "loads",
      document: "documents",
      documents: "documents",
      message: "messages",
      messages: "messages",
      task: "tasks",
      tasks: "tasks",
      finance: "finance",
      location: "location",
    };
    const prefKey = categoryMap[cat] ?? categoryMap[cat.toLowerCase()];
    if (prefKey && prefs[prefKey] === false) return; // User opted out of this category
  }

  // Check quiet hours
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
    .first();

  if (settings?.quietHoursEnabled && n.type !== "urgent") {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    const [startH, startM] = (settings.quietHoursStart ?? "22:00").split(":").map(Number);
    const [endH, endM] = (settings.quietHoursEnd ?? "07:00").split(":").map(Number);
    const quietStart = startH * 60 + (startM ?? 0);
    const quietEnd = endH * 60 + (endM ?? 0);

    const inQuietHours = quietStart > quietEnd
      ? currentTime >= quietStart || currentTime < quietEnd
      : currentTime >= quietStart && currentTime < quietEnd;

    if (inQuietHours && settings.notificationPrefs?.urgentOnlyDuringQuiet) {
      return; // Suppress non-urgent during quiet hours
    }
  }

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
