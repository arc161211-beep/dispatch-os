import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { CARRIER_STATUSES, FEE_TYPES } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { calcDispatcherFee, centsToDollars } from "./lib/finance";
import { optString, parseTags, positiveNumber, reqString, safeDate, validEmail } from "./lib/validation";

const carrierInput = v.object({
  companyName: v.string(),
  legalName: v.optional(v.string()),
  dba: v.optional(v.string()),
  contactName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  mcNumber: v.optional(v.string()),
  usdot: v.optional(v.string()),
  equipment: v.optional(v.array(v.string())),
  fleetSize: v.optional(v.number()),
  preferredLanes: v.optional(v.array(v.string())),
  avoidedLanes: v.optional(v.array(v.string())),
  homeTime: v.optional(v.string()),
  feeType: v.union(...FEE_TYPES.map((f) => v.literal(f))),
  feeRatePercent: v.optional(v.number()),
  feeMinCents: v.optional(v.number()),
  feeMaxCents: v.optional(v.number()),
  flatFeeCents: v.optional(v.number()),
  insuranceExpiry: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: { search: v.optional(v.string()), status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let carriers = await ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (scope.carrierId) carriers = carriers.filter((c) => c._id === scope.carrierId);
    if (args.status) carriers = carriers.filter((c) => c.status === args.status);
    if (args.search) {
      const q = args.search.toLowerCase();
      carriers = carriers.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          (c.contactName ?? "").toLowerCase().includes(q) ||
          (c.mcNumber ?? "").toLowerCase().includes(q),
      );
    }
    carriers.sort((a, b) => a.companyName.localeCompare(b.companyName));
    return carriers.slice(0, args.limit ?? 300);
  },
});

export const get = query({
  args: { id: v.id("carriers") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    if (scope.carrierId && scope.carrierId !== args.id) throw new ConvexError("Carrier not found.");
    const carrier = await ctx.db.get(args.id);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const agreements = await ctx.db.query("carrierAgreements").withIndex("by_carrier", (q) => q.eq("carrierId", args.id)).order("desc").take(10);
    return { carrier, agreements };
  },
});

export const getStats = query({
  args: { id: v.id("carriers") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    if (scope.carrierId && scope.carrierId !== args.id) throw new ConvexError("Carrier not found.");
    const [trucks, drivers, loads, invoices] = await Promise.all([
      ctx.db.query("trucks").withIndex("by_org_carrier", (q) => q.eq("orgId", s.orgId).eq("carrierId", args.id)).collect(),
      ctx.db.query("drivers").withIndex("by_org_carrier", (q) => q.eq("orgId", s.orgId).eq("carrierId", args.id)).collect(),
      ctx.db.query("loads").withIndex("by_org_carrier", (q) => q.eq("orgId", s.orgId).eq("carrierId", args.id)).collect(),
      ctx.db.query("invoices").withIndex("by_org_carrier", (q) => q.eq("orgId", s.orgId).eq("carrierId", args.id)).collect(),
    ]);
    const active = ["Active"].includes((await ctx.db.get(args.id))?.status ?? "");
    return {
      truckCount: trucks.length,
      availableTrucks: trucks.filter((t) => t.availability === "Available").length,
      driverCount: drivers.length,
      loadCount: loads.length,
      activeLoads: loads.filter((l) => !["Completed", "Cancelled"].includes(l.status)).length,
      completedLoads: loads.filter((l) => l.status === "Completed").length,
      grossBookedCents: loads.reduce((sum, l) => sum + (l.grossRateCents ?? 0), 0),
      dispatcherFeeCents: loads.reduce((sum, l) => sum + (l.feeCents ?? 0), 0),
      outstandingCents: invoices.reduce((sum, i) => sum + (i.amountCents - i.paidCents), 0),
      invoiceCount: invoices.length,
      active,
    };
  },
});

export const create = mutation({
  args: { input: carrierInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    const id = await ctx.db.insert("carriers", {
      orgId: s.orgId as never,
      companyName: reqString(input.companyName, "Company name"),
      legalName: optString(input.legalName, 200),
      dba: optString(input.dba, 200),
      contactName: optString(input.contactName, 200),
      email: validEmail(input.email),
      phone: optString(input.phone, 40),
      address: optString(input.address, 500),
      mcNumber: optString(input.mcNumber, 40),
      usdot: optString(input.usdot, 40),
      equipment: input.equipment ?? undefined,
      fleetSize: positiveNumber(input.fleetSize, "Fleet size"),
      preferredLanes: input.preferredLanes ?? undefined,
      avoidedLanes: input.avoidedLanes ?? undefined,
      homeTime: optString(input.homeTime, 200),
      feeType: input.feeType,
      feeRatePercent: positiveNumber(input.feeRatePercent, "Fee percentage"),
      feeMinCents: positiveNumber(input.feeMinCents, "Fee minimum"),
      feeMaxCents: positiveNumber(input.feeMaxCents, "Fee maximum"),
      flatFeeCents: positiveNumber(input.flatFeeCents, "Flat fee"),
      insuranceExpiry: safeDate(input.insuranceExpiry, "insurance expiry"),
      status: "Prospect",
      agreementStatus: "None",
      notes: optString(input.notes, 4000),
    });
    await ctx.db.insert("conversations", {
      orgId: s.orgId as never,
      title: `Carrier: ${input.companyName}`,
      entityType: "carrier",
      entityId: id,
      status: "active",
    });
    await audit(ctx, s, { action: "carrier.created", entity: "carrier", entityId: id, metadata: { company: input.companyName } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("carriers"), input: carrierInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const carrier = await ctx.db.get(args.id);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    if (patch.companyName !== undefined) patch.companyName = reqString(patch.companyName as string, "Company name");
    if (patch.email !== undefined) patch.email = validEmail(patch.email as string);
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "carrier.updated", entity: "carrier", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

export const setStatus = mutation({
  args: { id: v.id("carriers"), status: v.union(...CARRIER_STATUSES.map((c) => v.literal(c))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const carrier = await ctx.db.get(args.id);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const from = carrier.status;
    await ctx.db.patch(args.id, { status: args.status });
    await audit(ctx, s, { action: "carrier.status.changed", entity: "carrier", entityId: args.id, metadata: { from, to: args.status } });
    return { ok: true };
  },
});

/** Example of the fee at a given gross amount for this carrier's config. */
export const previewFee = query({
  args: { id: v.id("carriers"), grossCents: v.number() },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const carrier = await ctx.db.get(args.id);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const b = calcDispatcherFee(args.grossCents, carrier);
    return { ...b, feeDollars: centsToDollars(b.feeCents), carrierDollars: centsToDollars(b.carrierCents) };
  },
});

export const saveAgreement = mutation({
  args: {
    carrierId: v.id("carriers"),
    status: v.union(v.literal("Draft"), v.literal("Sent"), v.literal("Signed"), v.literal("Expired")),
    agreementText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const carrier = await ctx.db.get(args.carrierId);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const id = await ctx.db.insert("carrierAgreements", {
      orgId: s.orgId as never,
      carrierId: args.carrierId,
      status: args.status,
      agreementText: args.agreementText,
      signedAt: args.status === "Signed" ? Date.now() : undefined,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.carrierId, {
      agreementStatus: args.status,
      status: args.status === "Signed" ? "Active" : carrier.status,
    });
    await audit(ctx, s, { action: "carrier.agreement.updated", entity: "carrier", entityId: args.carrierId, metadata: { status: args.status } });
    return { id };
  },
});

export const importCarriers = mutation({
  args: {
    rows: v.array(
      v.object({
        companyName: v.string(),
        contactName: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        mcNumber: v.optional(v.string()),
        usdot: v.optional(v.string()),
        equipment: v.optional(v.string()),
        fleetSize: v.optional(v.number()),
        feeType: v.optional(v.string()),
        feeRatePercent: v.optional(v.number()),
        status: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    const errors: { row: number; error: string }[] = [];
    let inserted = 0;
    const existing = await ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      const name = (r.companyName ?? "").trim();
      if (!name) {
        errors.push({ row: i + 2, error: "Company name is required." });
        continue;
      }
      const dup = existing.find((e) => e.companyName.toLowerCase() === name.toLowerCase());
      if (dup) {
        errors.push({ row: i + 2, error: `Duplicate carrier (${name}) — skipped.` });
        continue;
      }
      const feeType = r.feeType === "flat" ? "flat" : "percentage";
      const id = await ctx.db.insert("carriers", {
        orgId: s.orgId as never,
        companyName: name,
        contactName: r.contactName?.trim() || undefined,
        email: r.email?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        mcNumber: r.mcNumber?.trim() || undefined,
        usdot: r.usdot?.trim() || undefined,
        equipment: parseTags(r.equipment),
        fleetSize: r.fleetSize,
        feeType,
        feeRatePercent: r.feeRatePercent ?? settings?.feeDefaults.feeRatePercent ?? 7,
        status: (CARRIER_STATUSES as readonly string[]).includes(r.status ?? "") ? (r.status as never) : "Prospect",
        agreementStatus: "None",
      });
      await ctx.db.insert("conversations", {
        orgId: s.orgId as never,
        title: `Carrier: ${name}`,
        entityType: "carrier",
        entityId: id,
        status: "active",
      });
      inserted++;
    }
    await ctx.db.insert("importJobs", {
      orgId: s.orgId as never,
      entityType: "carriers",
      totalRows: args.rows.length,
      inserted,
      errors: errors.length ? errors : undefined,
      status: errors.length === 0 ? "success" : inserted === 0 ? "failed" : "partial",
      importedBy: s.userId as never,
      at: Date.now(),
    });
    await audit(ctx, s, { action: "import.completed", entity: "importJob", metadata: { entityType: "carriers", total: args.rows.length, inserted, errors: errors.length } });
    return { inserted, errors };
  },
});
