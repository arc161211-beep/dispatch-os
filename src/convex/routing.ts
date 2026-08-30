// ---------------------------------------------------------------------------
// OpenRouteService routing integration for DispatchOS.
//
// Provides driving route calculation between two points:
//   - Distance in miles
//   - Estimated driving duration
//   - Route geometry (decoded polyline coordinates for MapLibre rendering)
//
// SECURITY: All ORS API calls happen server-side. The API key is read from
// process.env.OPENROUTESERVICE_API_KEY and never exposed to the frontend.
// ---------------------------------------------------------------------------

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, query, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// ---------------------------------------------------------------------------
// Polyline decoder (Google Encoded Polyline Algorithm)
// ---------------------------------------------------------------------------

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}

// ---------------------------------------------------------------------------
// Auth helper for actions (mirrors ai.ts pattern)
// ---------------------------------------------------------------------------

interface Session {
  userId: Id<"users">;
  orgId: Id<"organizations">;
}

async function getSessionForAction(ctx: ActionCtx): Promise<Session> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("You must be signed in.");
  const user = await ctx.runQuery(api.users.currentUser, {});
  if (!user?.orgId) throw new ConvexError("Workspace not ready.");
  return { userId, orgId: user.orgId };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteResult {
  /** Driving distance in miles */
  distanceMiles: number;
  /** Estimated driving duration in seconds */
  durationSeconds: number;
  /** Human-readable distance (e.g. "342.5 mi") */
  distanceText: string;
  /** Human-readable duration (e.g. "5h 24m") */
  durationText: string;
  /** Decoded route coordinates [lng, lat] pairs for MapLibre rendering */
  geometry: [number, number][];
  /** Whether the routing service is configured */
  configured: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDistance(miles: number): string {
  return miles >= 100 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
}

/** Geocode a place name using ORS geocoding API. Returns [lng, lat] or null. */
async function geocodePlace(apiKey: string, address: string): Promise<[number, number] | null> {
  const url = `https://api.heigit.org/geocode/search/structured?api_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(address)}&size=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    return data.features?.[0]?.geometry?.coordinates ?? null;
  } catch {
    return null;
  }
}

/** Call ORS directions API and return parsed result. */
async function callORSDirections(
  apiKey: string,
  coords: string,
): Promise<{ distanceMiles: number; durationSeconds: number; geometry: [number, number][] } | null> {
  const url = `https://api.heigit.org/ors/v2/directions/driving/car?coordinates=${coords}&geometry=encoded_polyline&instructions=false&units=mi`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[routing] ORS API error (${res.status}):`, errText.slice(0, 200));
    return null;
  }

  const data = (await res.json()) as {
    routes?: {
      summary?: { distance?: number; duration?: number };
      geometry?: string;
    }[];
  };

  const route = data.routes?.[0];
  if (!route?.summary || !route.geometry) return null;

  return {
    distanceMiles: route.summary.distance ?? 0,
    durationSeconds: route.summary.duration ?? 0,
    geometry: decodePolyline(route.geometry),
  };
}

function emptyResult(configured: boolean): RouteResult {
  return {
    distanceMiles: 0,
    durationSeconds: 0,
    distanceText: "—",
    durationText: "—",
    geometry: [],
    configured,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Calculate a driving route between two coordinate pairs. */
export const getDrivingRoute = action({
  args: {
    originLat: v.number(),
    originLng: v.number(),
    destinationLat: v.number(),
    destinationLng: v.number(),
  },
  handler: async (ctx, args): Promise<RouteResult> => {
    await getSessionForAction(ctx);

    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) return emptyResult(false);

    // Validate coordinates
    if (
      args.originLat < -90 || args.originLat > 90 ||
      args.originLng < -180 || args.originLng > 180 ||
      args.destinationLat < -90 || args.destinationLat > 90 ||
      args.destinationLng < -180 || args.destinationLng > 180
    ) {
      throw new ConvexError("Invalid coordinates provided.");
    }

    // ORS expects coordinates as lng,lat pairs
    const coords = `${args.originLng},${args.originLat}|${args.destinationLng},${args.destinationLat}`;

    try {
      const result = await callORSDirections(apiKey, coords);
      if (!result) return emptyResult(true);

      return {
        distanceMiles: result.distanceMiles,
        durationSeconds: result.durationSeconds,
        distanceText: formatDistance(result.distanceMiles),
        durationText: formatDuration(result.durationSeconds),
        geometry: result.geometry,
        configured: true,
      };
    } catch (e) {
      console.error("[routing] getDrivingRoute failed:", e);
      return emptyResult(true);
    }
  },
});

/** Calculate a driving route from two place-name strings (geocodes first). */
export const getRouteFromAddresses = action({
  args: {
    originAddress: v.string(),
    destinationAddress: v.string(),
  },
  handler: async (ctx, args): Promise<RouteResult> => {
    await getSessionForAction(ctx);

    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) return emptyResult(false);

    if (!args.originAddress.trim() || !args.destinationAddress.trim()) {
      throw new ConvexError("Both origin and destination addresses are required.");
    }

    // Geocode both addresses in parallel
    const [originCoords, destCoords] = await Promise.all([
      geocodePlace(apiKey, args.originAddress),
      geocodePlace(apiKey, args.destinationAddress),
    ]);

    if (!originCoords || !destCoords) {
      return emptyResult(true);
    }

    // geocodePlace returns [lng, lat]
    const coords = `${originCoords[0]},${originCoords[1]}|${destCoords[0]},${destCoords[1]}`;

    try {
      const result = await callORSDirections(apiKey, coords);
      if (!result) return emptyResult(true);

      return {
        distanceMiles: result.distanceMiles,
        durationSeconds: result.durationSeconds,
        distanceText: formatDistance(result.distanceMiles),
        durationText: formatDuration(result.durationSeconds),
        geometry: result.geometry,
        configured: true,
      };
    } catch (e) {
      console.error("[routing] getRouteFromAddresses failed:", e);
      return emptyResult(true);
    }
  },
});

/** Check whether the routing service is configured. */
export const routingConfig = query({
  args: {},
  handler: async () => {
    return { configured: !!process.env.OPENROUTESERVICE_API_KEY };
  },
});
