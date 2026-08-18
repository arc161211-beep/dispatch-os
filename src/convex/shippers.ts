import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireOrg, requireWrite } from "./lib/context";
import { optString, reqString, validEmail } from "./lib/validation";

const shipperInput = v.object({
  company: v.string(),
  location: v.optional(v.string()),
  address: v.optional(v.string()),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: { search: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    let shippers = await ctx.db.query("shippers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.search) {
      const q = args.search.toLowerCase();
      shippers = shippers.filter((sh) => sh.company.toLowerCase().includes(q) || (sh.location ?? "").toLowerCase().includes(q));
    }
    shippers.sort((a, b) => a.company.localeCompare(b.company));
    return shippers.slice(0, args.limit ?? 300);
  },
});

export const create = mutation({
  args: { input: shipperInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    const id = await ctx.db.insert("shippers", {
      orgId: s.orgId as never,
      company: reqString(input.company, "Company"),
      location: optString(input.location, 200),
      address: optString(input.address, 500),
      contactName: optString(input.contactName, 200),
      phone: optString(input.phone, 40),
      email: validEmail(input.email),
      notes: optString(input.notes, 4000),
    });
    await audit(ctx, s, { action: "shipper.created", entity: "shipper", entityId: id, metadata: { company: input.company } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("shippers"), input: shipperInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const shipper = await ctx.db.get(args.id);
    if (!shipper || shipper.orgId !== s.orgId) throw new ConvexError("Shipper not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "shipper.updated", entity: "shipper", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});
