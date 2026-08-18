import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DRIVER_STATUSES } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { optString, reqString, safeDate, validEmail } from "./lib/validation";

const driverInput = v.object({
  carrierId: v.id("carriers"),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  truckId: v.optional(v.id("trucks")),
  homeLocation: v.optional(v.string()),
  currentLocation: v.optional(v.string()),
  licenseExpiry: v.optional(v.number()),
  medicalCardExpiry: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: { search: v.optional(v.string()), availability: v.optional(v.string()), carrierId: v.optional(v.id("carriers")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let drivers = await ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (scope.carrierId) drivers = drivers.filter((d) => d.carrierId === scope.carrierId);
    if (args.carrierId) drivers = drivers.filter((d) => d.carrierId === args.carrierId);
    if (args.availability) drivers = drivers.filter((d) => d.availability === args.availability);
    if (args.search) {
      const q = args.search.toLowerCase();
      drivers = drivers.filter((d) => d.name.toLowerCase().includes(q) || (d.phone ?? "").toLowerCase().includes(q));
    }
    drivers.sort((a, b) => a.name.localeCompare(b.name));
    return drivers.slice(0, args.limit ?? 300);
  },
});

export const get = query({
  args: { id: v.id("drivers") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const driver = await ctx.db.get(args.id);
    if (!driver || driver.orgId !== s.orgId) throw new ConvexError("Driver not found.");
    if (scope.carrierId && driver.carrierId !== scope.carrierId) throw new ConvexError("Driver not found.");
    const carrier = await ctx.db.get(driver.carrierId);
    return { driver, carrierName: carrier?.companyName ?? "" };
  },
});

export const create = mutation({
  args: { input: driverInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    const carrier = await ctx.db.get(input.carrierId);
    if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    const id = await ctx.db.insert("drivers", {
      orgId: s.orgId as never,
      carrierId: input.carrierId,
      name: reqString(input.name, "Driver name"),
      phone: optString(input.phone, 40),
      email: validEmail(input.email),
      truckId: input.truckId,
      homeLocation: optString(input.homeLocation, 200),
      currentLocation: optString(input.currentLocation, 200),
      availability: "Available",
      licenseExpiry: safeDate(input.licenseExpiry, "license expiry"),
      medicalCardExpiry: safeDate(input.medicalCardExpiry, "medical card expiry"),
      notes: optString(input.notes, 2000),
    });
    await audit(ctx, s, { action: "driver.created", entity: "driver", entityId: id, metadata: { name: input.name, carrierId: input.carrierId } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("drivers"), input: driverInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const driver = await ctx.db.get(args.id);
    if (!driver || driver.orgId !== s.orgId) throw new ConvexError("Driver not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "driver.updated", entity: "driver", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

export const setAvailability = mutation({
  args: { id: v.id("drivers"), availability: v.union(...DRIVER_STATUSES.map((d) => v.literal(d))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const driver = await ctx.db.get(args.id);
    if (!driver || driver.orgId !== s.orgId) throw new ConvexError("Driver not found.");
    const from = driver.availability;
    await ctx.db.patch(args.id, { availability: args.availability });
    await audit(ctx, s, { action: "driver.status.changed", entity: "driver", entityId: args.id, metadata: { from, to: args.availability } });
    return { ok: true };
  },
});

export const importDrivers = mutation({
  args: {
    rows: v.array(
      v.object({
        carrierName: v.string(),
        name: v.string(),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        truckUnit: v.optional(v.string()),
        homeLocation: v.optional(v.string()),
        availability: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const errors: { row: number; error: string }[] = [];
    let inserted = 0;
    const carriers = await ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    const trucks = await ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    const existing = await ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      const name = (r.name ?? "").trim();
      const carrier = carriers.find((c) => c.companyName.toLowerCase() === (r.carrierName ?? "").toLowerCase());
      if (!name) {
        errors.push({ row: i + 2, error: "Driver name is required." });
        continue;
      }
      if (!carrier) {
        errors.push({ row: i + 2, error: `Carrier "${r.carrierName}" not found.` });
        continue;
      }
      if (existing.find((d) => d.name.toLowerCase() === name.toLowerCase() && d.carrierId === carrier._id)) {
        errors.push({ row: i + 2, error: `Duplicate driver ${name} — skipped.` });
        continue;
      }
      const truck = trucks.find((t) => t.unitNumber.toLowerCase() === (r.truckUnit ?? "").toLowerCase() && t.carrierId === carrier._id);
      await ctx.db.insert("drivers", {
        orgId: s.orgId as never,
        carrierId: carrier._id,
        name,
        phone: r.phone?.trim() || undefined,
        email: r.email?.trim() || undefined,
        truckId: truck?._id,
        homeLocation: r.homeLocation?.trim() || undefined,
        availability: (DRIVER_STATUSES as readonly string[]).includes(r.availability ?? "") ? (r.availability as never) : "Available",
      });
      inserted++;
    }
    await ctx.db.insert("importJobs", {
      orgId: s.orgId as never,
      entityType: "drivers",
      totalRows: args.rows.length,
      inserted,
      errors: errors.length ? errors : undefined,
      status: errors.length === 0 ? "success" : inserted === 0 ? "failed" : "partial",
      importedBy: s.userId as never,
      at: Date.now(),
    });
    await audit(ctx, s, { action: "import.completed", entity: "importJob", metadata: { entityType: "drivers", total: args.rows.length, inserted, errors: errors.length } });
    return { inserted, errors };
  },
});
