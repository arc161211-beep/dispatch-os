// ---------------------------------------------------------------------------
// Load matching engine.
//
// Returns a 0–100 match score with human-readable reasons. This is an
// OPERATIONAL RECOMMENDATION only — it is not a legal or HOS certification.
// The score is deterministic (no AI involved) and derived from data on file.
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadScope, requireOrg } from "./lib/context";

export interface MatchInput {
  equipment?: string | null;
  origin?: string | null;
  destination?: string | null;
  pickupDate?: number | null;
  deliveryDate?: number | null;
  weight?: number | null;
  preferredLanes?: string[] | null;
  avoidedLanes?: string[] | null;
  maxWeight?: number | null;
  currentLocation?: string | null;
  availability: string;
  currentLoadId?: string | null;
  driverAvailability?: string | null;
  homeTime?: string | null;
}

export interface MatchResult {
  score: number;
  tier: "Strong Match" | "Good Match" | "Possible Match" | "Weak Match";
  reasons: string[];
  concerns: string[];
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function lanesOverlap(lanes: string[] | null | undefined, text: string): boolean {
  const t = normalize(text);
  return (lanes ?? []).some((l) => {
    const n = normalize(l);
    if (!n) return false;
    // Match if the lane token appears in the location text or vice versa.
    return t.includes(n) || n.includes(t);
  });
}

export function scoreTruckForLoad(load: MatchInput, truck: MatchInput): MatchResult {
  let score = 40;
  const reasons: string[] = [];
  const concerns: string[] = [];

  // Equipment compatibility (weight: 15)
  const loadEquip = normalize(load.equipment);
  const truckEquip = normalize(truck.equipment);
  if (loadEquip && truckEquip) {
    if (loadEquip === truckEquip) {
      score += 15;
      reasons.push(`Equipment matches (${truck.equipment})`);
    } else {
      concerns.push(`Equipment mismatch: load needs ${load.equipment}, truck is ${truck.equipment}`);
    }
  }

  // Availability (weight: 20)
  const isAvailable = truck.availability === "Available";
  const hasLoad = !!truck.currentLoadId;
  if (isAvailable && !hasLoad) {
    score += 20;
    reasons.push("Truck is available with no current load");
  } else if (isAvailable) {
    score += 5;
    concerns.push("Truck marked available but assigned to a load — verify");
  } else {
    concerns.push(`Truck status is "${truck.availability}"`);
  }

  // Driver availability (weight: 10)
  if (truck.driverAvailability) {
    if (truck.driverAvailability === "Available") {
      score += 10;
      reasons.push("Assigned driver is available");
    } else {
      concerns.push(`Assigned driver status is "${truck.driverAvailability}"`);
    }
  }

  // Pickup timing (weight: 10)
  if (load.pickupDate) {
    const now = Date.now();
    const inHours = (load.pickupDate - now) / 3_600_000;
    if (inHours > 0 && inHours <= 72) {
      score += 10;
      reasons.push("Pickup is within the next 72 hours");
    } else if (inHours > 72) {
      reasons.push("Pickup is more than 72 hours out");
    } else if (inHours > -24) {
      score += 2;
      concerns.push("Pickup is very soon — confirm driver can get there");
    } else {
      concerns.push("Pickup time has passed");
    }
  }

  // Location / deadhead (weight: 15, data-dependent)
  if (load.origin && truck.currentLocation) {
    const origin = normalize(load.origin);
    const loc = normalize(truck.currentLocation);
    if (origin === loc) {
      score += 15;
      reasons.push("Truck is at (or very near) the pickup origin");
    } else if (origin.includes(loc) || loc.includes(origin)) {
      score += 8;
      reasons.push(`Truck location (${truck.currentLocation}) is near the pickup origin`);
    } else {
      concerns.push(`Truck is at "${truck.currentLocation}" — deadhead may apply`);
    }
  } else {
    concerns.push("No truck location on file — deadhead unknown");
  }

  // Preferred lanes (weight: 10)
  const destText = `${load.destination ?? ""} ${load.origin ?? ""}`;
  const prefMatch = lanesOverlap(truck.preferredLanes, destText);
  const avoidMatch = lanesOverlap(truck.avoidedLanes, destText);
  if (prefMatch) {
    score += 10;
    reasons.push("Lane is in the truck's preferred lanes");
  }
  if (avoidMatch) {
    score -= 15;
    concerns.push("Lane is in the truck's avoided lanes");
  }

  // Weight capacity (weight: 10)
  if (load.weight && truck.maxWeight) {
    if (load.weight <= truck.maxWeight) {
      score += 10;
      reasons.push(`Weight ${load.weight} lbs is within capacity (${truck.maxWeight})`);
    } else {
      concerns.push(`Load weight ${load.weight} exceeds truck capacity ${truck.maxWeight}`);
    }
  }

  // Home time note
  if (truck.homeTime && load.destination) {
    const home = normalize(truck.homeTime);
    const dest = normalize(load.destination);
    if (home && dest && (dest.includes(home) || home.includes(dest))) {
      score += 5;
      reasons.push("Delivery is close to the driver's home area");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = score >= 85 ? "Strong Match" : score >= 65 ? "Good Match" : score >= 40 ? "Possible Match" : "Weak Match";
  return { score, tier, reasons, concerns };
}

/** Query wrapper: score every truck for a load, tenant + role scoped. */
export const matchTrucks = query({
  args: { loadId: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const load = await ctx.db.get(args.loadId);
    if (!load || load.orgId !== s.orgId) throw new Error("Load not found.");
    const scope = loadScope(s);
    let trucks = await ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (scope.carrierId) trucks = trucks.filter((t) => t.carrierId === scope.carrierId);
    if (load.carrierId) trucks = trucks.filter((t) => t.carrierId === load.carrierId);
    const drivers = await ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    const driverByTruck = new Map<string, (typeof drivers)[number]>();
    for (const d of drivers) if (d.truckId) driverByTruck.set(d.truckId, d);

    const results = trucks.map((truck) => {
      const driver = truck._id ? driverByTruck.get(truck._id) : undefined;
      const r = scoreTruckForLoad(load as never, {
        equipment: truck.type ?? undefined,
        availability: truck.availability,
        currentLoadId: truck.currentLoadId ?? undefined,
        currentLocation: truck.currentLocation ?? undefined,
        preferredLanes: truck.preferredLanes ?? undefined,
        avoidedLanes: truck.avoidedLanes ?? undefined,
        maxWeight: truck.maxWeight ?? undefined,
        homeTime: undefined,
        driverAvailability: driver?.availability ?? undefined,
      });
      return {
        truckId: truck._id,
        unitNumber: truck.unitNumber,
        type: truck.type ?? "",
        currentLocation: truck.currentLocation ?? "",
        availability: truck.availability,
        carrierId: truck.carrierId,
        driverName: driver?.name ?? null,
        driverAvailability: driver?.availability ?? null,
        match: r,
        alreadyAssigned: load.truckId === truck._id,
      };
    });
    results.sort((a, b) => b.match.score - a.match.score);
    return results;
  },
});
