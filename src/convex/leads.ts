import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { LEAD_SOURCES, LEAD_STATUSES } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { parseTags, positiveNumber, reqString, safeDate, validEmail, optString } from "./lib/validation";

const leadInput = v.object({
  companyName: v.string(),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  state: v.optional(v.string()),
  city: v.optional(v.string()),
  fleetSize: v.optional(v.number()),
  equipment: v.optional(v.array(v.string())),
  mc: v.optional(v.string()),
  usdot: v.optional(v.string()),
  source: v.optional(v.union(...LEAD_SOURCES.map((s) => v.literal(s)))),
  assignedTo: v.optional(v.id("users")),
  lastContactedAt: v.optional(v.number()),
  nextFollowUpAt: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let leads = await ctx.db.query("leads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.status) leads = leads.filter((l) => l.status === args.status);
    if (args.search) {
      const q = args.search.toLowerCase();
      leads = leads.filter(
        (l) =>
          l.companyName.toLowerCase().includes(q) ||
          (l.contactName ?? "").toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.mc ?? "").toLowerCase().includes(q),
      );
    }
    leads.sort((a, b) => (b.nextFollowUpAt ?? b._creationTime) - (a.nextFollowUpAt ?? a._creationTime));
    return leads.slice(0, args.limit ?? 300);
  },
});

export const get = query({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const lead = await ctx.db.get(args.id);
    if (!lead || lead.orgId !== s.orgId) throw new ConvexError("Lead not found.");
    const tasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(2000);
    const convos = await ctx.db.query("conversations").withIndex("by_org_entity", (q) =>
      q.eq("orgId", s.orgId).eq("entityType", "lead").eq("entityId", args.id),
    ).collect();
    return {
      lead,
      tasks: tasks.filter((t) => t.entityType === "lead" && t.entityId === args.id),
      conversations: convos,
    };
  },
});

export const create = mutation({
  args: { input: leadInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    const id = await ctx.db.insert("leads", {
      orgId: s.orgId as never,
      companyName: reqString(input.companyName, "Company name"),
      contactName: optString(input.contactName, 200),
      phone: optString(input.phone, 40),
      email: validEmail(input.email),
      website: optString(input.website, 200),
      state: optString(input.state, 60),
      city: optString(input.city, 120),
      fleetSize: positiveNumber(input.fleetSize, "Fleet size"),
      equipment: input.equipment ?? undefined,
      mc: optString(input.mc, 40),
      usdot: optString(input.usdot, 40),
      source: input.source,
      status: "New",
      assignedTo: input.assignedTo,
      lastContactedAt: safeDate(input.lastContactedAt),
      nextFollowUpAt: safeDate(input.nextFollowUpAt),
      notes: optString(input.notes, 4000),
    });
    await audit(ctx, s, { action: "lead.created", entity: "lead", entityId: id, metadata: { company: input.companyName } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("leads"), input: leadInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const lead = await ctx.db.get(args.id);
    if (!lead || lead.orgId !== s.orgId) throw new ConvexError("Lead not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    if (patch.companyName !== undefined) patch.companyName = reqString(patch.companyName as string, "Company name");
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "lead.updated", entity: "lead", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

export const setStatus = mutation({
  args: { id: v.id("leads"), status: v.union(...LEAD_STATUSES.map((s) => v.literal(s))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const lead = await ctx.db.get(args.id);
    if (!lead || lead.orgId !== s.orgId) throw new ConvexError("Lead not found.");
    const from = lead.status;
    await ctx.db.patch(args.id, { status: args.status });
    await audit(ctx, s, { action: "lead.status.changed", entity: "lead", entityId: args.id, metadata: { from, to: args.status } });
    if (args.status === "Active" && !lead.convertedToCarrierId) {
      const conv = await ctx.db.insert("conversations", {
        orgId: s.orgId as never,
        title: `Lead: ${lead.companyName}`,
        entityType: "lead",
        entityId: args.id,
        status: "active",
      });
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `Lead active: ${lead.companyName}`,
        body: "Ready for onboarding — convert to carrier when documents are in.",
        type: "lead",
      });
      return { ok: true, conversationId: conv };
    }
    return { ok: true };
  },
});

/** Convert a qualified lead into a Carrier, preserving all known information. */
export const convertToCarrier = mutation({
  args: { id: v.id("leads"), onboarding: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const lead = await ctx.db.get(args.id);
    if (!lead || lead.orgId !== s.orgId) throw new ConvexError("Lead not found.");
    if (lead.convertedToCarrierId) throw new ConvexError("This lead has already been converted.");

    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    const feeDefaults = settings?.feeDefaults ?? { feeType: "percentage" as const, feeRatePercent: 7 };

    const carrierId = (await ctx.db.insert("carriers", {
      orgId: s.orgId as never,
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      mcNumber: lead.mc,
      usdot: lead.usdot,
      equipment: lead.equipment,
      fleetSize: lead.fleetSize,
      address: [lead.city, lead.state].filter(Boolean).join(", ") || undefined,
      feeType: feeDefaults.feeType,
      feeRatePercent: feeDefaults.feeRatePercent,
      feeMinCents: feeDefaults.feeMinCents,
      feeMaxCents: feeDefaults.feeMaxCents,
      flatFeeCents: feeDefaults.flatFeeCents,
      status: args.onboarding ? "Onboarding" : "Prospect",
      agreementStatus: "None",
    })) as string;

    await ctx.db.patch(args.id, {
      convertedToCarrierId: carrierId as never,
      status: "Active",
    });

    // Carry conversation over to the carrier.
    const convs = await ctx.db.query("conversations").withIndex("by_org_entity", (q) =>
      q.eq("orgId", s.orgId).eq("entityType", "lead").eq("entityId", args.id),
    ).collect();
    for (const conv of convs) {
      await ctx.db.patch(conv._id, { entityType: "carrier", entityId: carrierId, title: `Carrier: ${lead.companyName}` });
    }
    if (convs.length === 0) {
      await ctx.db.insert("conversations", {
        orgId: s.orgId as never,
        title: `Carrier: ${lead.companyName}`,
        entityType: "carrier",
        entityId: carrierId,
        status: "active",
      });
    }

    await audit(ctx, s, {
      action: "lead.converted",
      entity: "lead",
      entityId: args.id,
      metadata: { carrierId },
    });
    await audit(ctx, s, { action: "carrier.created", entity: "carrier", entityId: carrierId, metadata: { fromLead: args.id } });

    return { carrierId };
  },
});

export const importLeads = mutation({
  args: { rows: v.array(v.object({ companyName: v.string(), contactName: v.optional(v.string()), phone: v.optional(v.string()), email: v.optional(v.string()), city: v.optional(v.string()), state: v.optional(v.string()), mc: v.optional(v.string()), usdot: v.optional(v.string()), fleetSize: v.optional(v.number()), equipment: v.optional(v.string()), source: v.optional(v.string()) })) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const errors: { row: number; error: string }[] = [];
    let inserted = 0;
    const existing = await ctx.db.query("leads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      const company = (r.companyName ?? "").trim();
      if (!company) {
        errors.push({ row: i + 2, error: "Company name is required." });
        continue;
      }
      const dup = existing.find(
        (e) =>
          e.companyName.toLowerCase() === company.toLowerCase() &&
          (e.mc || "").toLowerCase() === (r.mc || "").toLowerCase(),
      );
      if (dup) {
        errors.push({ row: i + 2, error: `Duplicate lead (${company}) — skipped.` });
        continue;
      }
      await ctx.db.insert("leads", {
        orgId: s.orgId as never,
        companyName: company,
        contactName: r.contactName?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        email: r.email?.trim() || undefined,
        city: r.city?.trim() || undefined,
        state: r.state?.trim() || undefined,
        mc: r.mc?.trim() || undefined,
        usdot: r.usdot?.trim() || undefined,
        fleetSize: r.fleetSize,
        equipment: parseTags(r.equipment),
        source: (LEAD_SOURCES as readonly string[]).includes(r.source ?? "") ? (r.source as never) : "Manual",
        status: "New",
      });
      inserted++;
    }
    await ctx.db.insert("importJobs", {
      orgId: s.orgId as never,
      entityType: "leads",
      totalRows: args.rows.length,
      inserted,
      errors: errors.length ? errors : undefined,
      status: errors.length === 0 ? "success" : inserted === 0 ? "failed" : "partial",
      importedBy: s.userId as never,
      at: Date.now(),
    });
    await audit(ctx, s, { action: "import.completed", entity: "importJob", metadata: { entityType: "leads", total: args.rows.length, inserted, errors: errors.length } });
    return { inserted, errors };
  },
});
