import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/context";

export const list = query({
  args: { limit: v.optional(v.number()), action: v.optional(v.string()), entity: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    let logs = await ctx.db.query("auditLogs").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).order("desc").take(1000);
    if (args.action) logs = logs.filter((l) => l.action === args.action);
    if (args.entity) logs = logs.filter((l) => l.entity === args.entity);
    return logs.slice(0, args.limit ?? 300);
  },
});
