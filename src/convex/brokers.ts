import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { BROKER_STATUSES } from "./constants";
import { audit } from "./lib/audit";
import { requireOrg, requireWrite } from "./lib/context";
import { optString, reqString, validEmail } from "./lib/validation";

const brokerInput = v.object({
  company: v.string(),
  mc: v.optional(v.string()),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  address: v.optional(v.string()),
  status: v.union(...BROKER_STATUSES.map((b) => v.literal(b))),
  riskFlag: v.optional(v.union(v.literal("None"), v.literal("Review"), v.literal("Blocked"))),
  riskNotes: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: { search: v.optional(v.string()), status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    let brokers = await ctx.db.query("brokers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.status) brokers = brokers.filter((b) => b.status === args.status);
    if (args.search) {
      const q = args.search.toLowerCase();
      brokers = brokers.filter((b) => b.company.toLowerCase().includes(q) || (b.mc ?? "").toLowerCase().includes(q) || (b.contactName ?? "").toLowerCase().includes(q));
    }
    brokers.sort((a, b) => a.company.localeCompare(b.company));
    return brokers.slice(0, args.limit ?? 300);
  },
});

export const get = query({
  args: { id: v.id("brokers") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const broker = await ctx.db.get(args.id);
    if (!broker || broker.orgId !== s.orgId) throw new ConvexError("Broker not found.");
    const loads = await ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(500);
    const brokerLoads = loads.filter((l) => l.brokerId === args.id);
    const convos = await ctx.db.query("conversations").withIndex("by_org_entity", (q) =>
      q.eq("orgId", s.orgId).eq("entityType", "broker").eq("entityId", args.id),
    ).collect();
    return {
      broker,
      loadCount: brokerLoads.length,
      grossCents: brokerLoads.reduce((sum, l) => sum + (l.grossRateCents ?? 0), 0),
      conversations: convos,
    };
  },
});

export const create = mutation({
  args: { input: brokerInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    const id = await ctx.db.insert("brokers", {
      orgId: s.orgId as never,
      company: reqString(input.company, "Company"),
      mc: optString(input.mc, 40),
      contactName: optString(input.contactName, 200),
      phone: optString(input.phone, 40),
      email: validEmail(input.email),
      website: optString(input.website, 200),
      address: optString(input.address, 500),
      status: input.status ?? "New",
      riskFlag: input.riskFlag ?? "None",
      riskNotes: optString(input.riskNotes, 1000),
      notes: optString(input.notes, 4000),
    });
    await ctx.db.insert("conversations", {
      orgId: s.orgId as never,
      title: `Broker: ${input.company}`,
      entityType: "broker",
      entityId: id,
      status: "active",
    });
    await audit(ctx, s, { action: "broker.created", entity: "broker", entityId: id, metadata: { company: input.company } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("brokers"), input: brokerInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const broker = await ctx.db.get(args.id);
    if (!broker || broker.orgId !== s.orgId) throw new ConvexError("Broker not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "broker.updated", entity: "broker", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

export const importBrokers = mutation({
  args: {
    rows: v.array(
      v.object({
        company: v.string(),
        mc: v.optional(v.string()),
        contactName: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        status: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const errors: { row: number; error: string }[] = [];
    let inserted = 0;
    const existing = await ctx.db.query("brokers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      const company = (r.company ?? "").trim();
      if (!company) {
        errors.push({ row: i + 2, error: "Company is required." });
        continue;
      }
      if (existing.find((b) => b.company.toLowerCase() === company.toLowerCase())) {
        errors.push({ row: i + 2, error: `Duplicate broker (${company}) — skipped.` });
        continue;
      }
      const id = await ctx.db.insert("brokers", {
        orgId: s.orgId as never,
        company,
        mc: r.mc?.trim() || undefined,
        contactName: r.contactName?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        email: r.email?.trim() || undefined,
        status: (BROKER_STATUSES as readonly string[]).includes(r.status ?? "") ? (r.status as never) : "New",
        riskFlag: "None",
      });
      await ctx.db.insert("conversations", {
        orgId: s.orgId as never,
        title: `Broker: ${company}`,
        entityType: "broker",
        entityId: id,
        status: "active",
      });
      inserted++;
    }
    await ctx.db.insert("importJobs", {
      orgId: s.orgId as never,
      entityType: "brokers",
      totalRows: args.rows.length,
      inserted,
      errors: errors.length ? errors : undefined,
      status: errors.length === 0 ? "success" : inserted === 0 ? "failed" : "partial",
      importedBy: s.userId as never,
      at: Date.now(),
    });
    await audit(ctx, s, { action: "import.completed", entity: "importJob", metadata: { entityType: "brokers", total: args.rows.length, inserted, errors: errors.length } });
    return { inserted, errors };
  },
});
