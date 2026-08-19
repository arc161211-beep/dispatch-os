// ---------------------------------------------------------------------------
// Location tracking for DispatchOS.
//
// Supports multiple location sources:
//   - driver_mobile: Driver mobile app / phone GPS
//   - browser_geolocation: Browser Geolocation API
//   - gps_telematics: External GPS/telematics provider
//   - manual: Dispatcher manually entered
//   - other: Unknown / future provider
//
// SECURITY: Location data is scoped to organization and carrier ownership.
// Drivers can only share their own location. Carrier admins can only view
// their own carrier's truck/driver locations.
// ---------------------------------------------------------------------------

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { LOCATION_SOURCES } from "./constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertTruckAccess(ctx: any, orgId: Id<"organizations">, truckId: Id<"trucks">, carrierId?: Id<"carriers">) {
  const truck = await ctx.db.get(truckId);
  if (!truck || truck.orgId !== orgId) throw new ConvexError("Truck not found.");
  if (carrierId && truck.carrierId !== carrierId) throw new ConvexError("Not found.");
  return truck;
}

async function assertDriverAccess(ctx: any, orgId: Id<"organizations">, driverId: Id<"drivers">, carrierId?: Id<"carriers">) {
  const driver = await ctx.db.get(driverId);
  if (!driver || driver.orgId !== orgId) throw new ConvexError("Driver not found.");
  if (carrierId && driver.carrierId !== carrierId) throw new ConvexError("Not found.");
  return driver;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get latest location for a truck or driver. */
export const getLatest = query({
  args: {
    entityType: v.union(v.literal("truck"), v.literal("driver")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);

    if (args.entityType === "truck") {
      await assertTruckAccess(ctx, s.orgId, args.entityId as Id<"trucks">, scope.carrierId);
    } else {
      await assertDriverAccess(ctx, s.orgId, args.entityId as Id<"drivers">, scope.carrierId);
    }

    const location = await ctx.db
      .query("locationHistory")
      .withIndex("by_org_entity", (q) =>
        q.eq("orgId", s.orgId).eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .first();

    return location ?? null;
  },
});

/** Get location history for a truck or driver. Uses indexed query efficiently. */
export const getHistory = query({
  args: {
    entityType: v.union(v.literal("truck"), v.literal("driver")),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);

    if (args.entityType === "truck") {
      await assertTruckAccess(ctx, s.orgId, args.entityId as Id<"trucks">, scope.carrierId);
    } else {
      await assertDriverAccess(ctx, s.orgId, args.entityId as Id<"drivers">, scope.carrierId);
    }

    const locations = await ctx.db
      .query("locationHistory")
      .withIndex("by_org_entity", (q) =>
        q.eq("orgId", s.orgId).eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .take(args.limit ?? 50);

    return locations;
  },
});

/** Get all truck locations for the map view.
 *  FIX: Now queries the latest location from locationHistory per truck
 *  instead of using truck._creationTime. */
export const getTruckLocations = query({
  args: {
    carrierId: v.optional(v.id("carriers")),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);

    // Get all trucks (scoped by carrier for carrier_admin/driver)
    let trucks = await ctx.db
      .query("trucks")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .collect();

    if (scope.carrierId) {
      trucks = trucks.filter((t) => t.carrierId === scope.carrierId);
    }
    if (args.carrierId) {
      trucks = trucks.filter((t) => t.carrierId === args.carrierId);
    }

    // Get latest location for each truck that has coordinates
    const results: {
      truckId: string;
      unitNumber: string;
      type: string | undefined;
      carrierId: string;
      availability: string;
      lat: number;
      lon: number;
      location: string | undefined;
      locationSource: string | undefined;
      locationAccuracy: number | undefined;
      at: number;
      driverName?: string;
      isLive: boolean;
    }[] = [];

    for (const truck of trucks) {
      if (truck.lat === undefined || truck.lon === undefined) continue;

      // Query the latest location from locationHistory (correct timestamp)
      const latestLocation = await ctx.db
        .query("locationHistory")
        .withIndex("by_org_entity", (q) =>
          q.eq("orgId", s.orgId).eq("entityType", "truck").eq("entityId", truck._id),
        )
        .order("desc")
        .first();

      // Find the driver assigned to this truck
      let driverName: string | undefined;
      if (truck.currentLoadId) {
        const load = await ctx.db.get(truck.currentLoadId);
        if (load && "driverId" in load && load.driverId) {
          const driver = await ctx.db.get(load.driverId);
          if (driver && "name" in driver) driverName = driver.name as string;
        }
      }

      const locationTime = latestLocation?.at ?? truck._creationTime;
      const age = Date.now() - locationTime;
      // Consider "live" if updated within the last 15 minutes
      const isLive = age < 15 * 60 * 1000;

      results.push({
        truckId: truck._id,
        unitNumber: truck.unitNumber,
        type: truck.type,
        carrierId: truck.carrierId,
        availability: truck.availability,
        lat: latestLocation?.lat ?? truck.lat,
        lon: latestLocation?.lon ?? truck.lon,
        location: latestLocation?.location ?? truck.currentLocation,
        locationSource: latestLocation?.source,
        locationAccuracy: latestLocation?.accuracy,
        at: locationTime,
        driverName,
        isLive,
      });
    }

    return results;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Record a new location update for a truck. */
export const updateTruckLocation = mutation({
  args: {
    truckId: v.id("trucks"),
    lat: v.number(),
    lon: v.number(),
    location: v.optional(v.string()),
    source: v.optional(
      v.union(...LOCATION_SOURCES.map((s) => v.literal(s))),
    ),
    accuracy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const truck = await ctx.db.get(args.truckId);
    if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");

    // Drivers can only update their own assigned truck
    if (s.role === "driver") {
      if (!s.driverId) throw new ConvexError("No driver profile found.");
      const driver = await ctx.db.get(s.driverId);
      if (!driver || !("truckId" in driver) || driver.truckId !== args.truckId) {
        throw new ConvexError("You can only update your assigned truck's location.");
      }
    } else if (s.role === "carrier_admin") {
      if (!s.carrierId || truck.carrierId !== s.carrierId) {
        throw new ConvexError("You can only update trucks in your carrier.");
      }
    }

    // Update truck's current location
    await ctx.db.patch(args.truckId, {
      lat: args.lat,
      lon: args.lon,
      currentLocation: args.location,
    });

    // Record in location history
    await ctx.db.insert("locationHistory", {
      orgId: s.orgId as never,
      entityType: "truck",
      entityId: args.truckId,
      lat: args.lat,
      lon: args.lon,
      location: args.location,
      source: args.source,
      accuracy: args.accuracy,
      at: Date.now(),
    });

    return { ok: true };
  },
});

/** Record a new location update for a driver. */
export const updateDriverLocation = mutation({
  args: {
    driverId: v.id("drivers"),
    lat: v.number(),
    lon: v.number(),
    location: v.optional(v.string()),
    source: v.optional(
      v.union(...LOCATION_SOURCES.map((s) => v.literal(s))),
    ),
    accuracy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const driver = await ctx.db.get(args.driverId);
    if (!driver || driver.orgId !== s.orgId) throw new ConvexError("Driver not found.");

    // Drivers can only update their own location
    if (s.role === "driver") {
      if (s.driverId !== args.driverId) {
        throw new ConvexError("You can only update your own location.");
      }
    } else if (s.role === "carrier_admin") {
      if (!s.carrierId || driver.carrierId !== s.carrierId) {
        throw new ConvexError("You can only update drivers in your carrier.");
      }
    }

    // Update driver's current location
    await ctx.db.patch(args.driverId, {
      currentLocation: args.location,
      lat: args.lat,
      lon: args.lon,
    } as any);

    // Record in location history
    await ctx.db.insert("locationHistory", {
      orgId: s.orgId as never,
      entityType: "driver",
      entityId: args.driverId,
      lat: args.lat,
      lon: args.lon,
      location: args.location,
      source: args.source,
      accuracy: args.accuracy,
      at: Date.now(),
    });

    return { ok: true };
  },
});

/** Bulk update truck locations (for telematics integrations). */
export const bulkUpdateLocations = mutation({
  args: {
    updates: v.array(
      v.object({
        entityType: v.union(v.literal("truck"), v.literal("driver")),
        entityId: v.string(),
        lat: v.number(),
        lon: v.number(),
        location: v.optional(v.string()),
        source: v.optional(
          v.union(...LOCATION_SOURCES.map((s) => v.literal(s))),
        ),
        accuracy: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    let updated = 0;

    for (const update of args.updates) {
      if (update.entityType === "truck") {
        const truck = await ctx.db.get(update.entityId as Id<"trucks">);
        if (!truck || truck.orgId !== s.orgId) continue;
      } else {
        const driver = await ctx.db.get(update.entityId as Id<"drivers">);
        if (!driver || driver.orgId !== s.orgId) continue;
      }

      // Update entity's current location
      await ctx.db.patch(update.entityId as any, {
        lat: update.lat,
        lon: update.lon,
        currentLocation: update.location,
      } as any);

      // Record in history
      await ctx.db.insert("locationHistory", {
        orgId: s.orgId as never,
        entityType: update.entityType,
        entityId: update.entityId,
        lat: update.lat,
        lon: update.lon,
        location: update.location,
        source: update.source ?? "gps_telematics",
        accuracy: update.accuracy,
        at: Date.now(),
      });

      updated++;
    }

    await audit(ctx, s, {
      action: "location.bulk_updated",
      entity: "locationHistory",
      metadata: { count: updated, source: args.updates[0]?.source },
    });

    return { updated };
  },
});

/** Clean up old location history based on retention settings.
 *  Safe: only deletes locationHistory, never financial or audit data. */
export const cleanupOldLocations = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .first();
    const days = settings?.dataRetention?.locationHistoryDays;
    if (!days || days <= 0) return { deleted: 0, message: "No retention policy configured." };

    const cutoff = Date.now() - days * 86_400_000;
    const old = await ctx.db
      .query("locationHistory")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .filter((q) => q.lt(q.field("at"), cutoff))
      .take(500); // batch size

    let deleted = 0;
    for (const row of old) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    return { deleted, message: `Deleted ${deleted} records older than ${days} days.` };
  },
});
