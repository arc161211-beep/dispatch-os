import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { TRUCK_STATUSES } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { optString, positiveNumber, reqString, parseTags } from "./lib/validation";

const truckInput = v.object({
  carrierId: v.id("carriers"),
  unitNumber: v.string(),
  vin: v.optional(v.string()),
  type: v.optional(v.string()),
  make: v.optional(v.string()),
  model: v.optional(v.string()),
  year: v.optional(v.number()),
  plate: v.optional(v.string()),
  plateState: v.optional(v.string()),
  trailer: v.optional(v.string()),
  currentLocation: v.optional(v.string()),
  lat: v.optional(v.number()),
  lon: v.optional(v.number()),
  preferredLanes: v.optional(v.array(v.string())),
  avoidedLanes: v.optional(v.array(v.string())),
  maxWeight: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: { search: v.optional(v.string()), availability: v.optional(v.string()), carrierId: v.optional(v.id("carriers")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let trucks = await ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (scope.carrierId) trucks = trucks.filter((t) => t.carrierId === scope.carrierId);
    if (args.carrierId) trucks = trucks.filter((t) => t.carrierId === args.carrierId);
    if (args.availability) trucks = trucks.filter((t) => t.availability === args.availability);
    if (args.search) {
      const q = args.search.toLowerCase();
      trucks = trucks.filter((t) => t.unitNumber.toLowerCase().includes(q) || (t.vin ?? "").toLowerCase().includes(q) || (t.currentLocation ?? "").toLowerCase().includes(q));
    }
    trucks.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
    return trucks.slice(0, args.limit ?? 300);
  },
});

export const get = query({
  args: { id: v.id("trucks") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const truck = await ctx.db.get(args.id);
    if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");
    if (scope.carrierId && truck.carrierId !== scope.carrierId) throw new ConvexError("Truck not found.");
    const carrier = await ctx.db.get(truck.carrierId);
    return { truck, carrierName: carrier?.companyName ?? "" };
  },
});

export const create = mutation({
  args: { input: truckInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    // Validate coordinates if provided
    if (input.lat !== undefined && input.lat !== null) {
      if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) throw new ConvexError("Latitude must be between -90 and 90.");
    }
    if (input.lon !== undefined && input.lon !== null) {
      if (!Number.isFinite(input.lon) || input.lon < -180 || input.lon > 180) throw new ConvexError("Longitude must be between -180 and 180.");
    }
    const carrier = await ctx.db.get(input.carrierId);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const id = await ctx.db.insert("trucks", {
      orgId: s.orgId as never,
      carrierId: input.carrierId,
      unitNumber: reqString(input.unitNumber, "Unit number"),
      vin: optString(input.vin, 40),
      type: optString(input.type, 60),
      make: optString(input.make, 60),
      model: optString(input.model, 60),
      year: positiveNumber(input.year, "Year"),
      plate: optString(input.plate, 40),
      plateState: optString(input.plateState, 20),
      trailer: optString(input.trailer, 60),
      currentLocation: optString(input.currentLocation, 200),
      lat: input.lat,
      lon: input.lon,
      availability: "Available",
      preferredLanes: input.preferredLanes ?? undefined,
      avoidedLanes: input.avoidedLanes ?? undefined,
      maxWeight: positiveNumber(input.maxWeight, "Max weight"),
      notes: optString(input.notes, 2000),
    });
    await audit(ctx, s, { action: "truck.created", entity: "truck", entityId: id, metadata: { unitNumber: input.unitNumber, carrierId: input.carrierId } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("trucks"), input: truckInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const truck = await ctx.db.get(args.id);
    if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "truck.updated", entity: "truck", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

export const setAvailability = mutation({
  args: { id: v.id("trucks"), availability: v.union(...TRUCK_STATUSES.map((t) => v.literal(t))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const truck = await ctx.db.get(args.id);
    if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");
    const from = truck.availability;
    await ctx.db.patch(args.id, { availability: args.availability });
    await audit(ctx, s, { action: "truck.status.changed", entity: "truck", entityId: args.id, metadata: { from, to: args.availability } });
    return { ok: true };
  },
});

export const importTrucks = mutation({
  args: {
    rows: v.array(
      v.object({
        carrierName: v.string(),
        unitNumber: v.string(),
        type: v.optional(v.string()),
        make: v.optional(v.string()),
        model: v.optional(v.string()),
        year: v.optional(v.number()),
        plate: v.optional(v.string()),
        currentLocation: v.optional(v.string()),
        availability: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const errors: { row: number; error: string }[] = [];
    let inserted = 0;
    const carriers = await ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    const existing = await ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      const unit = (r.unitNumber ?? "").trim();
      const carrier = carriers.find((c) => c.companyName.toLowerCase() === (r.carrierName ?? "").toLowerCase());
      if (!unit) {
        errors.push({ row: i + 2, error: "Unit number is required." });
        continue;
      }
      if (!carrier) {
        errors.push({ row: i + 2, error: `Carrier "${r.carrierName}" not found.` });
        continue;
      }
      if (existing.find((t) => t.unitNumber.toLowerCase() === unit.toLowerCase() && t.carrierId === carrier._id)) {
        errors.push({ row: i + 2, error: `Duplicate unit ${unit} — skipped.` });
        continue;
      }
      await ctx.db.insert("trucks", {
        orgId: s.orgId as never,
        carrierId: carrier._id,
        unitNumber: unit,
        type: r.type?.trim() || undefined,
        make: r.make?.trim() || undefined,
        model: r.model?.trim() || undefined,
        year: r.year,
        plate: r.plate?.trim() || undefined,
        currentLocation: r.currentLocation?.trim() || undefined,
        availability: (TRUCK_STATUSES as readonly string[]).includes(r.availability ?? "") ? (r.availability as never) : "Available",
      });
      inserted++;
    }
    await ctx.db.insert("importJobs", {
      orgId: s.orgId as never,
      entityType: "trucks",
      totalRows: args.rows.length,
      inserted,
      errors: errors.length ? errors : undefined,
      status: errors.length === 0 ? "success" : inserted === 0 ? "failed" : "partial",
      importedBy: s.userId as never,
      at: Date.now(),
    });
    await audit(ctx, s, { action: "import.completed", entity: "importJob", metadata: { entityType: "trucks", total: args.rows.length, inserted, errors: errors.length } });
    return { inserted, errors };
  },
});

export { parseTags };
