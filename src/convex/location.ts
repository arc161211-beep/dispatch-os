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
 *
 *  PERFORMANCE FIX (H1): Instead of N separate locationHistory queries
 *  (one per truck), we query ALL org truck locations in a single batch,
 *  then group by entityId to find the latest per truck. This reduces
 *  N+1 queries to O(1) indexed queries.
 *
 *  SECURITY FIX (M2): Drivers without a driverId now see ZERO trucks
 *  instead of potentially seeing all org trucks.
 */
export const getTruckLocations = query({
  args: {
    carrierId: v.optional(v.id("carriers")),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);

    // SECURITY FIX (M2): Drivers without driverId see ZERO trucks.
    if (s.role === "driver" && !s.driverId) {
      return [];
    }

    // Get all trucks (scoped by carrier/driver)
    let trucks = await ctx.db
      .query("trucks")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .collect();

    if (scope.carrierId) {
      trucks = trucks.filter((t) => t.carrierId === scope.carrierId);
    }

    // Drivers should only see their assigned truck
    if (s.role === "driver" && s.driverId) {
      const driver = await ctx.db.get(s.driverId);
      if (driver && "truckId" in driver && driver.truckId) {
        trucks = trucks.filter((t) => t._id === driver.truckId);
      } else {
        trucks = [];
      }
    }

    if (args.carrierId) {
      trucks = trucks.filter((t) => t.carrierId === args.carrierId);
    }

    if (trucks.length === 0) return [];

    // PERFORMANCE FIX (H1): Batch-query all truck location histories in ONE query,
    // then group by entityId to find the latest per truck.
    // This replaces N individual queries with a single indexed scan + in-memory grouping.
    const allTruckLocations = await ctx.db
      .query("locationHistory")
      .withIndex("by_org_entity", (q) =>
        q.eq("orgId", s.orgId).eq("entityType", "truck"),
      )
      .order("desc")
      .take(trucks.length * 3); // take enough rows to cover multiple updates per truck

    // Group by entityId, keeping only the first (most recent) entry per truck
    const latestByTruck = new Map<string, typeof allTruckLocations[number]>();
    for (const loc of allTruckLocations) {
      if (!latestByTruck.has(loc.entityId)) {
        latestByTruck.set(loc.entityId, loc);
      }
    }

    // Build results using the batch-fetched locations
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
      trackingActive: boolean;
      speed: number | undefined;
      heading: number | undefined;
    }[] = [];

    for (const truck of trucks) {
      const latestLocation = latestByTruck.get(truck._id) ?? null;

      // Skip trucks with no coordinates at all
      const hasLat = (latestLocation?.lat ?? truck.lat) !== undefined;
      const hasLon = (latestLocation?.lon ?? truck.lon) !== undefined;
      if (!hasLat || !hasLon) continue;

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
      const isLive = age < 15 * 60 * 1000;

      const resolvedLat: number = (latestLocation?.lat ?? truck.lat) as number;
      const resolvedLon: number = (latestLocation?.lon ?? truck.lon) as number;

      results.push({
        truckId: truck._id,
        unitNumber: truck.unitNumber,
        type: truck.type,
        carrierId: truck.carrierId,
        availability: truck.availability,
        lat: resolvedLat,
        lon: resolvedLon,
        location: latestLocation?.location ?? truck.currentLocation,
        locationSource: latestLocation?.source,
        locationAccuracy: latestLocation?.accuracy,
        at: locationTime,
        driverName,
        isLive,
        trackingActive: truck.trackingActive ?? false,
        speed: latestLocation?.speed ?? truck.speed,
        heading: latestLocation?.heading ?? truck.heading,
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
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate coordinates are within valid range
    if (args.lat < -90 || args.lat > 90) throw new ConvexError("Latitude must be between -90 and 90.");
    if (args.lon < -180 || args.lon > 180) throw new ConvexError("Longitude must be between -180 and 180.");
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

    // Update truck's current location and tracking fields in a single patch
    await ctx.db.patch(args.truckId, {
      lat: args.lat,
      lon: args.lon,
      currentLocation: args.location,
      trackingActive: true,
      lastLocationUpdateAt: Date.now(),
      speed: args.speed,
      heading: args.heading,
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
      speed: args.speed,
      heading: args.heading,
      at: Date.now(),
    });

    // PHASE 7 AUTO-ETA: Find active loads on this truck and auto-calculate ETA.
    // This runs server-side when the driver's GPS updates, so ETA stays current
    // without requiring a manual button press. Throttled to 5-min intervals by
    // the calculateETA mutation itself.
    const activeLoads = await ctx.db
      .query("loads")
      .withIndex("by_org_truck", (q) => q.eq("orgId", s.orgId).eq("truckId", args.truckId))
      .collect();

    for (const load of activeLoads) {
      const activeStatuses = ["In Transit", "At Pickup", "Loaded", "At Delivery"];
      if (!activeStatuses.includes(load.status)) continue;

      // Only auto-ETA if ETA was calculated >5min ago or never calculated
      if (load.etaUpdatedAt && Date.now() - load.etaUpdatedAt < 5 * 60 * 1000) continue;

      // Need destination coordinates for ETA
      if (load.destinationLat == null || load.destinationLng == null) continue;

      // Haversine distance
      const R = 3958.8;
      const dLat = ((load.destinationLat - args.lat) * Math.PI) / 180;
      const dLng = ((load.destinationLng - args.lon) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((args.lat * Math.PI) / 180) * Math.cos((load.destinationLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const distMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const durSec = Math.round((distMiles / 55) * 3600);
      const etaTimestamp = Date.now() + durSec * 1000;

      let deliveryRisk: "on_time" | "at_risk" | "delayed" | "unknown" = "on_time";
      let delayMinutes = 0;
      const prevRisk = load.deliveryRisk;
      if (load.deliveryDate && etaTimestamp > load.deliveryDate) {
        delayMinutes = Math.round((etaTimestamp - load.deliveryDate) / 60000);
        deliveryRisk = delayMinutes > 60 ? "delayed" : "at_risk";
      }
      const etaStatus: "on_time" | "at_risk" | "delayed" | "unknown" = deliveryRisk;

      await ctx.db.patch(load._id, {
        eta: etaTimestamp,
        etaDistanceMiles: Math.round(distMiles * 10) / 10,
        etaDurationSeconds: durSec,
        etaUpdatedAt: Date.now(),
        etaStatus,
        deliveryRisk,
        delayMinutes,
      });

      // Notify ALL write-role users (dispatchers) when risk status changes.
      // The GPS reporter (s.userId) is usually the driver — they already know
      // they are late. Dispatchers need to be notified.
      if (prevRisk !== deliveryRisk && (deliveryRisk === "at_risk" || deliveryRisk === "delayed") && load.driverId) {
        const WRITE_ROLES_RISK = new Set(["admin", "super_admin", "dispatcher", "operations"]);
        const riskUsers = await ctx.db
          .query("users")
          .withIndex("by_org", (q: any) => q.eq("orgId", s.orgId))
          .take(50);
        for (const u of riskUsers) {
          if (!u.role || !WRITE_ROLES_RISK.has(u.role)) continue;
          await ctx.db.insert("notifications", {
            orgId: s.orgId as never,
            userId: u._id as never,
            title: deliveryRisk === "delayed"
              ? `⚠ DELAYED: Load ${load.loadNumber}`
              : `⚡ At Risk: Load ${load.loadNumber}`,
            body: deliveryRisk === "delayed"
              ? `${load.loadNumber} is estimated ${delayMinutes} min late. ETA: ${new Date(etaTimestamp).toLocaleTimeString()}`
              : `${load.loadNumber} may be late. ETA: ${new Date(etaTimestamp).toLocaleTimeString()}`,
            link: `/loads/${load._id}`,
            type: "load",
          });
        }
      }
    }

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
    // Validate coordinates are within valid range
    if (args.lat < -90 || args.lat > 90) throw new ConvexError("Latitude must be between -90 and 90.");
    if (args.lon < -180 || args.lon > 180) throw new ConvexError("Longitude must be between -180 and 180.");
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
      // Validate coordinates are within valid range
      if (update.lat < -90 || update.lat > 90) continue;
      if (update.lon < -180 || update.lon > 180) continue;
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

// ---------------------------------------------------------------------------
// Live GPS Tracking — Start / Stop
// ---------------------------------------------------------------------------

/** Start live GPS tracking for a truck. */
export const startTracking = mutation({
  args: { truckId: v.id("trucks") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const truck = await ctx.db.get(args.truckId);
    if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");

    // Drivers can only track their own assigned truck
    if (s.role === "driver") {
      if (!s.driverId) throw new ConvexError("No driver profile found.");
      const driver = await ctx.db.get(s.driverId);
      if (!driver || !("truckId" in driver) || driver.truckId !== args.truckId) {
        throw new ConvexError("You can only track your assigned truck.");
      }
    } else if (s.role === "carrier_admin") {
      if (!s.carrierId || truck.carrierId !== s.carrierId) {
        throw new ConvexError("You can only track trucks in your carrier.");
      }
    }

    await ctx.db.patch(args.truckId, { trackingActive: true });

    await audit(ctx, s, {
      action: "tracking.started",
      entity: "truck",
      entityId: args.truckId,
      metadata: { unitNumber: truck.unitNumber },
    });

    return { ok: true };
  },
});

/** Stop live GPS tracking for a truck. */
export const stopTracking = mutation({
  args: { truckId: v.id("trucks") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const truck = await ctx.db.get(args.truckId);
    if (!truck || truck.orgId !== s.orgId) throw new ConvexError("Truck not found.");

    // Drivers can only stop tracking on their own assigned truck
    if (s.role === "driver") {
      if (!s.driverId) throw new ConvexError("No driver profile found.");
      const driver = await ctx.db.get(s.driverId);
      if (!driver || !("truckId" in driver) || driver.truckId !== args.truckId) {
        throw new ConvexError("You can only stop tracking on your assigned truck.");
      }
    } else if (s.role === "carrier_admin") {
      if (!s.carrierId || truck.carrierId !== s.carrierId) {
        throw new ConvexError("You can only stop tracking on trucks in your carrier.");
      }
    }

    await ctx.db.patch(args.truckId, { trackingActive: false });

    await audit(ctx, s, {
      action: "tracking.stopped",
      entity: "truck",
      entityId: args.truckId,
      metadata: { unitNumber: truck.unitNumber },
    });

    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Secure Public Tracking
// ---------------------------------------------------------------------------

/** Generate a tracking token for a load (dispatcher only). */
export const generateTrackingToken = mutation({
  args: { loadId: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const load = await ctx.db.get(args.loadId);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");

    // Check for existing active token
    const existing = await ctx.db
      .query("trackingTokens")
      .withIndex("by_org_load", (q) =>
        q.eq("orgId", s.orgId).eq("loadId", args.loadId),
      )
      .filter((q) => q.eq(q.field("active"), true))
      .first();

    if (existing) {
      return { token: existing.token, alreadyExisted: true };
    }

    // Generate random token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const tokenId = await ctx.db.insert("trackingTokens", {
      orgId: s.orgId as never,
      loadId: args.loadId,
      truckId: load.truckId as Id<"trucks"> | undefined,
      token,
      active: true,
      createdBy: s.userId as never,
      createdAt: Date.now(),
    });

    await audit(ctx, s, {
      action: "tracking.token_generated",
      entity: "trackingToken",
      entityId: tokenId,
      metadata: { loadId: args.loadId, loadNumber: load.loadNumber },
    });

    return { token, alreadyExisted: false };
  },
});

/** Revoke a tracking token. */
export const revokeTrackingToken = mutation({
  args: { tokenId: v.id("trackingTokens") },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const trackingToken = await ctx.db.get(args.tokenId);
    if (!trackingToken || trackingToken.orgId !== s.orgId) throw new ConvexError("Tracking token not found.");

    await ctx.db.patch(args.tokenId, { active: false, revokedAt: Date.now() });

    await audit(ctx, s, {
      action: "tracking.token_revoked",
      entity: "trackingToken",
      entityId: args.tokenId,
      metadata: { loadId: trackingToken.loadId },
    });

    return { ok: true };
  },
});

/** Get tracking tokens for an organization's load. */
export const getTrackingTokens = query({
  args: { loadId: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const load = await ctx.db.get(args.loadId);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");

    const tokens = await ctx.db
      .query("trackingTokens")
      .withIndex("by_org_load", (q) =>
        q.eq("orgId", s.orgId).eq("loadId", args.loadId),
      )
      .order("desc")
      .collect();

    return tokens;
  },
});

/** Public tracking query — no auth required. Returns location data for a tracking token. */
export const getPublicTracking = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Find the tracking token
    const trackingToken = await ctx.db
      .query("trackingTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!trackingToken || !trackingToken.active) {
      return { valid: false, error: "Tracking link is not active or does not exist." };
    }

    // Load the associated load
    const load = await ctx.db.get(trackingToken.loadId);
    if (!load) {
      return { valid: false, error: "Load not found." };
    }

    // Get latest truck location
    let latestLocation: any = null;
    if (trackingToken.truckId) {
      const truck = await ctx.db.get(trackingToken.truckId);
      if (truck && truck.lat !== undefined && truck.lon !== undefined) {
        // Query the latest location from locationHistory
        const loc = await ctx.db
          .query("locationHistory")
          .withIndex("by_org_entity", (q) =>
            q.eq("orgId", trackingToken.orgId)
              .eq("entityType", "truck")
              .eq("entityId", trackingToken.truckId!),
          )
          .order("desc")
          .first();

        const locationTime = loc?.at ?? truck._creationTime;
        const age = Date.now() - locationTime;
        const trackingAge = Date.now() - (trackingToken.createdAt);

        // Consider live if location updated within 15 min AND tracking started within 24 hours
        const isLive = age < 15 * 60 * 1000 && trackingAge < 24 * 60 * 60 * 1000;

        latestLocation = {
          lat: loc?.lat ?? truck.lat,
          lon: loc?.lon ?? truck.lon,
          at: locationTime,
          isLive,
          speed: loc?.speed ?? truck.speed,
          accuracy: loc?.accuracy,
        };
      }
    }

    return {
      valid: true,
      load: {
        loadNumber: load.loadNumber,
        origin: load.origin,
        destination: load.destination,
        pickupDate: load.pickupDate,
        deliveryDate: load.deliveryDate,
        status: load.status,
      },
      location: latestLocation,
      trackingActive: trackingToken.active,
    };
  },
});
