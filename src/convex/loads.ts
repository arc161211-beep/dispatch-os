import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { FEE_TYPES, LOAD_SOURCES, LOAD_STATUSES, LOAD_TRANSITIONS, TERMINAL_LOAD_STATUSES, LoadStatus } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { deriveLoadFinance } from "./lib/finance";
import { optString, parseTags, positiveNumber, reqString, safeDate } from "./lib/validation";
import { filterLoadFinancials, getFinancialVisibility, requiresFinancialFiltering } from "./lib/visibility";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSettings(ctx: QueryCtx, orgId: Id<"organizations">) {
  return ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", orgId)).first();
}

const loadInput = v.object({
  externalId: v.optional(v.string()),
  brokerId: v.optional(v.id("brokers")),
  shipperId: v.optional(v.id("shippers")),
  carrierId: v.optional(v.id("carriers")),
  truckId: v.optional(v.id("trucks")),
  driverId: v.optional(v.id("drivers")),
  equipment: v.optional(v.string()),
  commodity: v.optional(v.string()),
  weight: v.optional(v.number()),
  pieces: v.optional(v.number()),
  origin: v.optional(v.string()),
  originAddress: v.optional(v.string()),
  pickupDate: v.optional(v.number()),
  pickupTime: v.optional(v.string()),
  pickupRef: v.optional(v.string()),
  destination: v.optional(v.string()),
  destAddress: v.optional(v.string()),
  deliveryDate: v.optional(v.number()),
  deliveryTime: v.optional(v.string()),
  deliveryRef: v.optional(v.string()),
  loadedMiles: v.optional(v.number()),
  deadheadMiles: v.optional(v.number()),
  grossRateCents: v.optional(v.number()),
  fuelSurchargeCents: v.optional(v.number()),
  accessorialsCents: v.optional(v.number()),
  accessorialsNote: v.optional(v.string()),
  feeType: v.optional(v.union(...FEE_TYPES.map((f) => v.literal(f)))),
  feeRatePercent: v.optional(v.number()),
  feeMinCents: v.optional(v.number()),
  feeMaxCents: v.optional(v.number()),
  flatFeeCents: v.optional(v.number()),
  priority: v.optional(v.union(v.literal("Low"), v.literal("Normal"), v.literal("High"), v.literal("Urgent"))),
  source: v.optional(v.union(...LOAD_SOURCES.map((s) => v.literal(s)))),
  sourceExternalId: v.optional(v.string()),
  notes: v.optional(v.string()),
  originLat: v.optional(v.number()),
  originLng: v.optional(v.number()),
  originFormatted: v.optional(v.string()),
  destinationLat: v.optional(v.number()),
  destinationLng: v.optional(v.number()),
  destinationFormatted: v.optional(v.string()),
});

type LoadInput = {
  grossRateCents?: number;
  loadedMiles?: number;
  deadheadMiles?: number;
  fuelSurchargeCents?: number;
  accessorialsCents?: number;
  feeType?: "percentage" | "flat";
  feeRatePercent?: number;
  feeMinCents?: number;
  feeMaxCents?: number;
  flatFeeCents?: number;
};

/** Compute fee/finance patch for a load from its (possibly partial) input. */
async function financePatch(ctx: any, orgId: Id<"organizations">, input: LoadInput, carrierId?: string) {
  const resolved: LoadInput = { ...input };
  if (resolved.feeType === undefined) {
    const carrier = carrierId ? await ctx.db.get(carrierId) : null;
    if (carrier && carrier.orgId === orgId) {
      resolved.feeType = carrier.feeType;
      resolved.feeRatePercent = carrier.feeRatePercent;
      resolved.feeMinCents = carrier.feeMinCents;
      resolved.feeMaxCents = carrier.feeMaxCents;
      resolved.flatFeeCents = carrier.flatFeeCents;
    } else {
      const settings = await getSettings(ctx, orgId);
      if (settings) {
        resolved.feeType = settings.feeDefaults.feeType;
        resolved.feeRatePercent = settings.feeDefaults.feeRatePercent;
        resolved.feeMinCents = settings.feeDefaults.feeMinCents;
        resolved.feeMaxCents = settings.feeDefaults.feeMaxCents;
        resolved.flatFeeCents = settings.feeDefaults.flatFeeCents;
      }
    }
  }
  const derived = deriveLoadFinance(resolved);
  return {
    feeType: resolved.feeType,
    feeRatePercent: resolved.feeRatePercent,
    feeMinCents: resolved.feeMinCents,
    feeMaxCents: resolved.feeMaxCents,
    flatFeeCents: resolved.flatFeeCents,
    feeCents: derived.feeCents,
    carrierAmountCents: derived.carrierCents,
    rpm: derived.rpm ?? undefined,
    effectiveRpm: derived.effectiveRpm ?? undefined,
  };
}

async function nextLoadNumber(ctx: any, orgId: Id<"organizations">): Promise<string> {
  const settings = await getSettings(ctx, orgId);
  const n = (settings?.lastLoadNumber ?? 0) + 1;
  if (settings) await ctx.db.patch(settings._id, { lastLoadNumber: n });
  return `LD-${1000 + n}`;
}

async function nextInvoiceNumber(ctx: any, orgId: Id<"organizations">): Promise<string> {
  const settings = await getSettings(ctx, orgId);
  const n = (settings?.lastInvoiceNumber ?? 0) + 1;
  if (settings) await ctx.db.patch(settings._id, { lastInvoiceNumber: n });
  return `INV-${1000 + n}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    status: v.optional(v.string()),
    carrierId: v.optional(v.id("carriers")),
    brokerId: v.optional(v.id("brokers")),
    search: v.optional(v.string()),
    upcomingOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let loads = await ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (scope.carrierId) loads = loads.filter((l) => l.carrierId === scope.carrierId);
    if (scope.driverId) loads = loads.filter((l) => l.driverId === scope.driverId);
    if (args.status) loads = loads.filter((l) => l.status === args.status);
    if (args.carrierId) loads = loads.filter((l) => l.carrierId === args.carrierId);
    if (args.brokerId) loads = loads.filter((l) => l.brokerId === args.brokerId);
    if (args.upcomingOnly) {
      const now = Date.now();
      loads = loads.filter((l) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus) && (l.pickupDate ?? Infinity) >= now - 36e5);
    }
    if (args.search) {
      const q = args.search.toLowerCase();
      loads = loads.filter(
        (l) =>
          l.loadNumber.toLowerCase().includes(q) ||
          (l.origin ?? "").toLowerCase().includes(q) ||
          (l.destination ?? "").toLowerCase().includes(q) ||
          (l.externalId ?? "").toLowerCase().includes(q) ||
          (l.commodity ?? "").toLowerCase().includes(q),
      );
    }
    loads.sort((a, b) => b._creationTime - a._creationTime);
    const sliced = loads.slice(0, args.limit ?? 300);
    if (requiresFinancialFiltering(s.role)) {
      const vis = await getFinancialVisibility(ctx, s.orgId);
      return sliced.map((l) => filterLoadFinancials(l, vis));
    }
    return sliced;
  },
});

export const get = query({
  args: { id: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let loadRecord = await ctx.db.get(args.id);
    if (!loadRecord || loadRecord.orgId !== s.orgId) throw new ConvexError("Load not found.");
    if (scope.carrierId && loadRecord.carrierId !== scope.carrierId) throw new ConvexError("Load not found.");
    if (scope.driverId && loadRecord.driverId !== scope.driverId) throw new ConvexError("Load not found.");

    if (requiresFinancialFiltering(s.role)) {
      const vis = await getFinancialVisibility(ctx, s.orgId);
      loadRecord = filterLoadFinancials(loadRecord, vis) as typeof loadRecord;
    }
    const load = loadRecord;

    const [broker, shipper, carrier, truck, driver, statusHistory, rateHistory, documents, invoices, conversations] = await Promise.all([
      load.brokerId ? ctx.db.get(load.brokerId) : null,
      load.shipperId ? ctx.db.get(load.shipperId) : null,
      load.carrierId ? ctx.db.get(load.carrierId) : null,
      load.truckId ? ctx.db.get(load.truckId) : null,
      load.driverId ? ctx.db.get(load.driverId) : null,
      ctx.db.query("loadStatusHistory").withIndex("by_load", (q) => q.eq("loadId", args.id)).order("desc").take(100),
      ctx.db.query("rateHistory").withIndex("by_load", (q) => q.eq("loadId", args.id)).order("desc").take(100),
      ctx.db.query("documents").withIndex("by_org_entity", (q) => q.eq("orgId", s.orgId).eq("entityType", "load").eq("entityId", args.id)).collect(),
      ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect().then((all) => all.filter((i) => i.loadId === args.id)),
      ctx.db.query("conversations").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect().then((all) => all.filter((c) => c.entityType === "broker" && c.entityId === load.brokerId)),
    ]);

    return {
      load,
      broker: broker ? { _id: broker._id, company: broker.company, phone: broker.phone, email: broker.email, contactName: broker.contactName } : null,
      shipper: shipper ? { _id: shipper._id, company: shipper.company, contactName: shipper.contactName, phone: shipper.phone } : null,
      carrier: carrier ? { _id: carrier._id, companyName: carrier.companyName, phone: carrier.phone, email: carrier.email } : null,
      truck: truck ? { _id: truck._id, unitNumber: truck.unitNumber, type: truck.type, currentLocation: truck.currentLocation, availability: truck.availability } : null,
      driver: driver ? { _id: driver._id, name: driver.name, phone: driver.phone, availability: driver.availability } : null,
      statusHistory,
      rateHistory,
      documents,
      invoices,
      conversations,
    };
  },
});

/** Pure calculation for the load form / detail preview. Backend is authoritative. */
export const calculate = query({
  args: {
    grossRateCents: v.optional(v.number()),
    fuelSurchargeCents: v.optional(v.number()),
    accessorialsCents: v.optional(v.number()),
    loadedMiles: v.optional(v.number()),
    deadheadMiles: v.optional(v.number()),
    carrierId: v.optional(v.id("carriers")),
    feeType: v.optional(v.union(...FEE_TYPES.map((f) => v.literal(f)))),
    feeRatePercent: v.optional(v.number()),
    feeMinCents: v.optional(v.number()),
    feeMaxCents: v.optional(v.number()),
    flatFeeCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    return financePatch(ctx, s.orgId, args, args.carrierId);
  },
});

export const duplicateCheck = query({
  args: {
    externalId: v.optional(v.string()),
    brokerId: v.optional(v.id("brokers")),
    origin: v.optional(v.string()),
    destination: v.optional(v.string()),
    pickupDate: v.optional(v.number()),
    grossRateCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const loads = await ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    const candidates = loads.filter((l) => {
      if (l.status === "Cancelled") return false;
      let hits = 0;
      if (args.externalId && l.externalId && l.externalId === args.externalId) hits += 2;
      if (args.brokerId && l.brokerId === args.brokerId) hits += 1;
      if (args.origin && l.origin && args.origin.toLowerCase() === l.origin.toLowerCase()) hits += 1;
      if (args.destination && l.destination && args.destination.toLowerCase() === l.destination.toLowerCase()) hits += 1;
      if (args.pickupDate && l.pickupDate && Math.abs(l.pickupDate - args.pickupDate) < 864e5) hits += 1;
      if (args.grossRateCents && l.grossRateCents === args.grossRateCents) hits += 1;
      return hits >= 3;
    });
    return candidates.slice(0, 5).map((l) => ({
      loadNumber: l.loadNumber,
      status: l.status,
      origin: l.origin,
      destination: l.destination,
      pickupDate: l.pickupDate,
      grossRateCents: l.grossRateCents,
      brokerId: l.brokerId,
    }));
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: { input: loadInput, status: v.optional(v.union(...LOAD_STATUSES.map((s) => v.literal(s)))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const input = args.input;
    const carrierId = input.carrierId ?? undefined;
    if (carrierId) {
      const carrier = await ctx.db.get(carrierId);
      if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    }
    const finance = await financePatch(ctx, s.orgId, input, carrierId);
    const loadNumber = await nextLoadNumber(ctx, s.orgId);
    const status = args.status ?? "Draft";

    const id = await ctx.db.insert("loads", {
      orgId: s.orgId as never,
      loadNumber,
      externalId: optString(input.externalId, 100),
      brokerId: input.brokerId,
      shipperId: input.shipperId,
      carrierId: input.carrierId,
      truckId: input.truckId,
      driverId: input.driverId,
      equipment: optString(input.equipment, 80),
      commodity: optString(input.commodity, 200),
      weight: positiveNumber(input.weight, "Weight"),
      pieces: positiveNumber(input.pieces, "Pieces"),
      origin: optString(input.origin, 200),
      originAddress: optString(input.originAddress, 500),
      pickupDate: safeDate(input.pickupDate),
      pickupTime: optString(input.pickupTime, 20),
      pickupRef: optString(input.pickupRef, 100),
      destination: optString(input.destination, 200),
      destAddress: optString(input.destAddress, 500),
      deliveryDate: safeDate(input.deliveryDate),
      deliveryTime: optString(input.deliveryTime, 20),
      deliveryRef: optString(input.deliveryRef, 100),
      loadedMiles: positiveNumber(input.loadedMiles, "Loaded miles"),
      deadheadMiles: positiveNumber(input.deadheadMiles, "Deadhead miles"),
      grossRateCents: positiveNumber(input.grossRateCents, "Gross rate"),
      fuelSurchargeCents: positiveNumber(input.fuelSurchargeCents, "Fuel surcharge"),
      accessorialsCents: positiveNumber(input.accessorialsCents, "Accessorials"),
      accessorialsNote: optString(input.accessorialsNote, 500),
      ...finance,
      priority: input.priority ?? "Normal",
      status,
      source: input.source ?? "manual",
      sourceExternalId: optString(input.sourceExternalId, 100),
      notes: optString(input.notes, 4000),
      originLat: input.originLat,
      originLng: input.originLng,
      originFormatted: optString(input.originFormatted, 500),
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      destinationFormatted: optString(input.destinationFormatted, 500),
    });

    await ctx.db.insert("loadStatusHistory", {
      orgId: s.orgId as never,
      loadId: id,
      to: status,
      actorId: s.userId as never,
      actorName: s.name,
      at: Date.now(),
    });
    await audit(ctx, s, {
      action: "load.created",
      entity: "load",
      entityId: id,
      metadata: { loadNumber, grossRateCents: input.grossRateCents, status },
    });

    if (input.truckId) {
      await ctx.db.patch(input.truckId, { currentLoadId: id as never });
      if (status !== "Draft") await ctx.db.patch(input.truckId, { availability: "Booked" });
    }
    return { id, loadNumber };
  },
});

export const update = mutation({
  args: { id: v.id("loads"), input: loadInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const load = await ctx.db.get(args.id);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");
    if (TERMINAL_LOAD_STATUSES.includes(load.status as LoadStatus)) {
      throw new ConvexError("Completed or cancelled loads cannot be edited. Reopen via Disputed if needed.");
    }
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    if (patch.carrierId !== undefined) {
      const carrier = await ctx.db.get(patch.carrierId as Id<"carriers">);
      if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    }

    // Rate history: never silently overwrite financial values.
    const rateFields: { field: string; key: keyof typeof load }[] = [
      { field: "grossRate", key: "grossRateCents" },
      { field: "fuelSurcharge", key: "fuelSurchargeCents" },
      { field: "accessorials", key: "accessorialsCents" },
    ];
    for (const rf of rateFields) {
      const prev = load[rf.key];
      const next = patch[rf.key];
      if (next !== undefined && prev !== next) {
        await ctx.db.insert("rateHistory", {
          orgId: s.orgId as never,
          loadId: args.id,
          field: rf.field,
          previousCents: prev as number | undefined,
          newCents: next as number | undefined,
          actorId: s.userId as never,
          actorName: s.name,
          reason: undefined,
          at: Date.now(),
        });
      }
    }

    const finance = await financePatch(ctx, s.orgId, patch as LoadInput, (patch.carrierId as string) ?? load.carrierId);
    Object.assign(patch, finance);

    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, {
      action: "load.updated",
      entity: "load",
      entityId: args.id,
      metadata: { fields: Object.keys(patch), hasRateChange: Object.keys(patch).some((k) => k.includes("Cents")) },
    });
    return { ok: true };
  },
});

const DRIVER_STATUS_TRANSITIONS: LoadStatus[] = ["At Pickup", "Loading", "Loaded", "In Transit", "At Delivery", "Delivered"];

/** Sync truck/driver availability + assignments with load progress. */
async function syncResources(ctx: any, load: any, status: LoadStatus) {
  if (load.truckId) {
    const truck = await ctx.db.get(load.truckId);
    if (!truck) return;
    const map: Partial<Record<LoadStatus, string>> = {
      Booked: "Booked",
      "Driver Notified": "Booked",
      "At Pickup": "At Pickup",
      Loading: "At Pickup",
      Loaded: "Loaded",
      "In Transit": "In Transit",
      "At Delivery": "At Delivery",
      Delivered: "Delivered",
      "POD Pending": "Delivered",
      Completed: "Available",
      Cancelled: "Available",
      Disputed: "At Delivery",
    };
    const next = map[status];
    if (next) {
      await ctx.db.patch(truck._id, {
        availability: next,
        currentLoadId: status === "Completed" || status === "Cancelled" ? undefined : truck.currentLoadId,
      });
    }
  }
  if (load.driverId && (status === "Completed" || status === "Cancelled")) {
    await ctx.db.patch(load.driverId, { availability: "Available" });
  }
}

export const setStatus = mutation({
  args: { id: v.id("loads"), status: v.union(...LOAD_STATUSES.map((s) => v.literal(s))), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const load = await ctx.db.get(args.id);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");

    // Drivers may only advance their own assigned load through operational states.
    if (s.role === "driver") {
      if (load.driverId !== s.driverId) throw new ConvexError("This load is not assigned to you.");
      if (!DRIVER_STATUS_TRANSITIONS.includes(args.status)) {
        throw new ConvexError("Drivers can only update operational status (pickup → delivered).");
      }
    } else {
      await requireWrite(ctx);
    }

    const from = load.status as LoadStatus;
    if (from === args.status) return { ok: true, note: "No change" };
    const allowed = LOAD_TRANSITIONS[from];
    if (!allowed.includes(args.status)) {
      throw new ConvexError(
        `Cannot move a "${from}" load to "${args.status}". Allowed: ${allowed.join(", ")} or nothing (terminal).`,
      );
    }

    await ctx.db.patch(args.id, { status: args.status });
    await ctx.db.insert("loadStatusHistory", {
      orgId: s.orgId as never,
      loadId: args.id,
      from,
      to: args.status,
      actorId: s.userId as never,
      actorName: s.name,
      note: optString(args.note, 1000),
      at: Date.now(),
    });
    await audit(ctx, s, { action: "load.status.changed", entity: "load", entityId: args.id, metadata: { from, to: args.status, note: args.note } });

    await syncResources(ctx, load, args.status);

    // Completion: calculate final fee + generate the dispatcher invoice.
    // IDEMPOTENT: Check if an invoice already exists for this load to prevent duplicates.
    if (args.status === "Completed") {
      const existingInvoice = await ctx.db
        .query("invoices")
        .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
        .collect()
        .then((all) => all.find((i) => i.loadId === args.id));

      if (!existingInvoice) {
        const invoiceNumber = await nextInvoiceNumber(ctx, s.orgId);
        const amountCents = load.feeCents ?? 0;
        await ctx.db.insert("invoices", {
          orgId: s.orgId as never,
          invoiceNumber,
          carrierId: load.carrierId,
          loadId: args.id,
          status: "Draft",
          issueDate: Date.now(),
          dueDate: Date.now() + 14 * 864e5,
          amountCents,
          paidCents: 0,
          notes: `Dispatcher fee for ${load.loadNumber}`,
        });
        await audit(ctx, s, { action: "invoice.created", entity: "invoice", metadata: { invoiceNumber, loadId: args.id, amountCents, fromLoadCompletion: true } });
        if (load.carrierId) {
          const carrier = await ctx.db.get(load.carrierId);
          await ctx.db.insert("notifications", {
            orgId: s.orgId as never,
            userId: s.userId as never,
            title: `Load ${load.loadNumber} completed`,
            body: `Invoice ${invoiceNumber} ($${(amountCents / 100).toFixed(2)}) created for ${carrier?.companyName ?? "carrier"}.`,
            link: "/finance",
            type: "load",
          });
        }
      } else {
        await audit(ctx, s, { action: "invoice.duplicate_prevented", entity: "invoice", metadata: { loadId: args.id, existingInvoiceId: existingInvoice._id } });
      }
    }

    if (args.status === "Cancelled") {
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `Load ${load.loadNumber} cancelled`,
        body: "Resources have been freed.",
        type: "load",
      });
    }

    return { ok: true };
  },
});

export const assignResources = mutation({
  args: {
    id: v.id("loads"),
    carrierId: v.optional(v.id("carriers")),
    truckId: v.optional(v.id("trucks")),
    driverId: v.optional(v.id("drivers")),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const load = await ctx.db.get(args.id);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");

    const patch: Record<string, unknown> = {};
    if (args.carrierId !== undefined) {
      const carrier = await ctx.db.get(args.carrierId);
      if (!carrier || carrier.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
      patch.carrierId = args.carrierId;
    }
    if (args.truckId !== undefined) {
      const truck = await ctx.db.get(args.truckId);
      if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");
      patch.truckId = args.truckId;
      if (load.truckId && load.truckId !== args.truckId) {
        const oldTruck = await ctx.db.get(load.truckId);
        if (oldTruck) await ctx.db.patch(oldTruck._id, { currentLoadId: undefined, availability: "Available" });
        // If the old load's driver is linked to the old truck, clear that assignment
        // so the driver doesn't appear assigned to a truck they are no longer using.
        if (load.driverId) {
          const oldDriver = await ctx.db.get(load.driverId);
          if (oldDriver && oldDriver.truckId === load.truckId) {
            await ctx.db.patch(load.driverId, { truckId: undefined });
          }
        }
      }
      await ctx.db.patch(args.truckId, { currentLoadId: args.id as never });
    }
    if (args.driverId !== undefined) {
      const driver = await ctx.db.get(args.driverId);
      if (!driver || driver.orgId !== s.orgId) throw new ConvexError("Driver not found.");
      patch.driverId = args.driverId;
      if (args.truckId) await ctx.db.patch(args.driverId, { truckId: args.truckId });
    }

    // Recompute fee if carrier changed.
    const changed: Record<string, unknown> = {};
    if (args.carrierId !== undefined) {
      const finance = await financePatch(ctx, s.orgId, {}, args.carrierId);
      Object.assign(changed, finance);
    }
    await ctx.db.patch(args.id, { ...patch, ...changed } as never);
    await audit(ctx, s, { action: "load.resources.assigned", entity: "load", entityId: args.id, metadata: { ...patch } });

    // Notify the driver when they are assigned to a load.
    if (args.driverId) {
      const driver = await ctx.db.get(args.driverId);
      const load = await ctx.db.get(args.id);
      if (driver && load) {
        await ctx.db.insert("notifications", {
          orgId: s.orgId as never,
          userId: s.userId as never,
          title: `Load assigned to ${driver.name}`,
          body: `${(load as any).loadNumber}: ${(load as any).origin ?? "?"} → ${(load as any).destination ?? "?"}`,
          link: `/loads/${args.id}`,
          type: "load",
        });
      }
    }

    return { ok: true };
  },
});

/** Delete a Draft load (only drafts; everything else is immutable history). */
export const remove = mutation({
  args: { id: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const load = await ctx.db.get(args.id);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");
    if (load.status !== "Draft") throw new ConvexError("Only draft loads can be deleted.");

    // Clean up related history records that belong exclusively to this draft.
    const [statusHistories, rateHistories] = await Promise.all([
      ctx.db.query("loadStatusHistory").withIndex("by_load", (q) => q.eq("loadId", args.id)).collect(),
      ctx.db.query("rateHistory").withIndex("by_load", (q) => q.eq("loadId", args.id)).collect(),
    ]);
    for (const record of statusHistories) {
      await ctx.db.delete(record._id);
    }
    for (const record of rateHistories) {
      await ctx.db.delete(record._id);
    }

    await ctx.db.delete(args.id);
    await audit(ctx, s, { action: "load.deleted", entity: "load", entityId: args.id, metadata: { loadNumber: load.loadNumber, statusHistoriesDeleted: statusHistories.length, rateHistoriesDeleted: rateHistories.length } });
    return { ok: true };
  },
});

export const importLoads = mutation({
  args: {
    rows: v.array(
      v.object({
        externalId: v.optional(v.string()),
        brokerName: v.optional(v.string()),
        carrierName: v.optional(v.string()),
        truckUnit: v.optional(v.string()),
        equipment: v.optional(v.string()),
        commodity: v.optional(v.string()),
        weight: v.optional(v.number()),
        origin: v.optional(v.string()),
        destination: v.optional(v.string()),
        pickupDate: v.optional(v.number()),
        deliveryDate: v.optional(v.number()),
        loadedMiles: v.optional(v.number()),
        deadheadMiles: v.optional(v.number()),
        grossRateCents: v.optional(v.number()),
        status: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const errors: { row: number; error: string }[] = [];
    let inserted = 0;
    const [carriers, brokers, trucks, existingLoads] = await Promise.all([
      ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("brokers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
    ]);
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      if (!r.origin && !r.destination) {
        errors.push({ row: i + 2, error: "At least an origin or destination is required." });
        continue;
      }
      const carrier = r.carrierName ? carriers.find((c) => c.companyName.toLowerCase() === r.carrierName!.toLowerCase()) : undefined;
      if (r.carrierName && !carrier) {
        errors.push({ row: i + 2, error: `Carrier "${r.carrierName}" not found.` });
        continue;
      }
      const truck = r.truckUnit && carrier ? trucks.find((t) => t.unitNumber.toLowerCase() === r.truckUnit!.toLowerCase() && t.carrierId === carrier._id) : undefined;
      if (r.truckUnit && !truck) {
        errors.push({ row: i + 2, error: `Truck "${r.truckUnit}" not found for carrier "${r.carrierName}".` });
        continue;
      }
      const broker = r.brokerName ? brokers.find((b) => b.company.toLowerCase() === r.brokerName!.toLowerCase()) : undefined;
      const dup =
        r.externalId && existingLoads.find((l) => l.externalId === r.externalId && !["Cancelled", "Completed"].includes(l.status));
      if (dup) {
        errors.push({ row: i + 2, error: `Duplicate load (external ID ${r.externalId}) — skipped.` });
        continue;
      }
      const finance = await financePatch(ctx, s.orgId, r, carrier?._id);
      const loadNumber = await nextLoadNumber(ctx, s.orgId);
      const status = (LOAD_STATUSES as readonly string[]).includes(r.status ?? "") ? (r.status as never) : "Draft";
      const id = await ctx.db.insert("loads", {
        orgId: s.orgId as never,
        loadNumber,
        externalId: r.externalId,
        brokerId: broker?._id,
        carrierId: carrier?._id,
        truckId: truck?._id,
        equipment: r.equipment?.trim() || undefined,
        commodity: r.commodity?.trim() || undefined,
        weight: r.weight,
        origin: r.origin?.trim() || undefined,
        destination: r.destination?.trim() || undefined,
        pickupDate: r.pickupDate,
        deliveryDate: r.deliveryDate,
        loadedMiles: r.loadedMiles,
        deadheadMiles: r.deadheadMiles,
        grossRateCents: r.grossRateCents,
        ...finance,
        priority: "Normal",
        status,
        source: "csv",
        sourceExternalId: r.externalId,
      });
      await ctx.db.insert("loadStatusHistory", {
        orgId: s.orgId as never,
        loadId: id,
        to: status,
        actorId: s.userId as never,
        actorName: s.name,
        at: Date.now(),
      });
      if (truck) await ctx.db.patch(truck._id, { currentLoadId: id as never });
      inserted++;
    }
    await ctx.db.insert("importJobs", {
      orgId: s.orgId as never,
      entityType: "loads",
      totalRows: args.rows.length,
      inserted,
      errors: errors.length ? errors : undefined,
      status: errors.length === 0 ? "success" : inserted === 0 ? "failed" : "partial",
      importedBy: s.userId as never,
      at: Date.now(),
    });
    await audit(ctx, s, { action: "import.completed", entity: "importJob", metadata: { entityType: "loads", total: args.rows.length, inserted, errors: errors.length } });
    return { inserted, errors };
  },
});

export { parseTags };
