import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrg } from "./lib/context";

export const list = query({
  args: { invoiceId: v.optional(v.id("invoices")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    let payments = await ctx.db.query("payments").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.invoiceId) payments = payments.filter((p) => p.invoiceId === args.invoiceId);
    payments.sort((a, b) => b.receivedAt - a.receivedAt);
    return payments.slice(0, args.limit ?? 300);
  },
});
