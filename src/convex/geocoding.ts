// ---------------------------------------------------------------------------
// Geoapify geocoding integration for DispatchOS.
//
// Converts addresses/city+state into latitude/longitude coordinates
// for use with MapLibre maps, OpenRouteService routing, and Open-Meteo weather.
//
// SECURITY: All calls happen server-side through Convex actions.
// GEOAPIFY_API_KEY is read from process.env and never exposed to frontend.
// ---------------------------------------------------------------------------

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, mutation, query, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { requireWrite, Session } from "./lib/context";
import { audit } from "./lib/audit";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getSessionForAction(ctx: ActionCtx): Promise<Session> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("You must be signed in.");
  const user = await ctx.runQuery(api.users.currentUser, {});
  if (!user?.orgId) throw new ConvexError("Workspace not ready.");
  return {
    userId,
    orgId: user.orgId,
    role: user.role ?? "read_only",
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    disabled: !!user.disabled,
  };
}

// ---------------------------------------------------------------------------
// Geoapify response types
// ---------------------------------------------------------------------------

interface GeoapifyFeature {
  type: "Feature";
  properties: {
    lat: number;
    lon: number;
    formatted: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    confidence?: number;
    rank?: {
      confidence?: number;
      confidence_city_level?: number;
    };
    place_id?: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

interface GeoapifyResponse {
  type: string;
  features: GeoapifyFeature[];
}

// ---------------------------------------------------------------------------
// Geocoding result type
// ---------------------------------------------------------------------------

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted: string;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  countryCode: string | null;
  confidence: number | null;
  placeId: string | null;
}

// ---------------------------------------------------------------------------
// Action: geocodeAddress
// ---------------------------------------------------------------------------

export const geocodeAddress = action({
  args: {
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ results: GeocodingResult[]; configured: boolean; error?: string }> => {
    await getSessionForAction(ctx);

    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return { results: [], configured: false, error: "Geoapify API key not configured." };
    }

    // Build the search text
    let searchText = args.address?.trim() ?? "";
    if (!searchText && args.city?.trim()) {
      searchText = args.city.trim();
      if (args.state?.trim()) searchText += `, ${args.state.trim()}`;
    }

    if (!searchText) {
      throw new ConvexError("Either address or city+state is required.");
    }

    if (args.country?.trim()) {
      searchText += `, ${args.country.trim()}`;
    }

    const params = new URLSearchParams({
      text: searchText,
      apiKey,
      lang: "en",
      limit: "3",
      filter: "countrycode:us", // Focus on US trucking
    });

    const url = `https://api.geoapify.com/v1/geocode/search?${params.toString()}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[geocoding] Geoapify error (${res.status}):`, errText.slice(0, 200));

        if (res.status === 401 || res.status === 403) {
          return { results: [], configured: true, error: "Invalid or unauthorized Geoapify API key." };
        }
        if (res.status === 429) {
          return { results: [], configured: true, error: "Geoapify rate limit exceeded. Please try again later." };
        }
        return { results: [], configured: true, error: `Geoapify returned status ${res.status}.` };
      }

      const data = (await res.json()) as GeoapifyResponse;

      if (!data.features || data.features.length === 0) {
        return { results: [], configured: true, error: "No results found for this address." };
      }

      const results: GeocodingResult[] = data.features.map((f) => ({
        latitude: f.properties.lat,
        longitude: f.properties.lon,
        formatted: f.properties.formatted ?? "",
        city: f.properties.city ?? null,
        state: f.properties.state ?? null,
        postcode: f.properties.postcode ?? null,
        country: f.properties.country ?? null,
        countryCode: f.properties.country_code ?? null,
        confidence: f.properties.rank?.confidence ?? f.properties.confidence ?? null,
        placeId: f.properties.place_id ?? null,
      }));

      return { results, configured: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[geocoding] request failed:", msg);
      if (msg.includes("timeout") || msg.includes("abort")) {
        return { results: [], configured: true, error: "Geocoding request timed out." };
      }
      return { results: [], configured: true, error: "Failed to reach geocoding service." };
    }
  },
});

// ---------------------------------------------------------------------------
// Mutation: patchLoadCoords — save geocoded coordinates to a load
// ---------------------------------------------------------------------------

export const patchLoadCoords = mutation({
  args: {
    loadId: v.id("loads"),
    originLat: v.optional(v.number()),
    originLng: v.optional(v.number()),
    originFormatted: v.optional(v.string()),
    destinationLat: v.optional(v.number()),
    destinationLng: v.optional(v.number()),
    destinationFormatted: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const load = await ctx.db.get(args.loadId);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");

    await ctx.db.patch(args.loadId, {
      originLat: args.originLat,
      originLng: args.originLng,
      originFormatted: args.originFormatted,
      destinationLat: args.destinationLat,
      destinationLng: args.destinationLng,
      destinationFormatted: args.destinationFormatted,
    });

    await audit(ctx, s, {
      action: "load.geocoded",
      entity: "load",
      entityId: args.loadId,
      metadata: { originLat: args.originLat, destinationLat: args.destinationLat },
    });

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Action: geocodeLoad — geocode a load's origin/destination and save coords
// ---------------------------------------------------------------------------

export const geocodeLoad = action({
  args: {
    loadId: v.id("loads"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    await getSessionForAction(ctx);

    // Load the current load data via query
    const load = await ctx.runQuery(api.loads.get, { id: args.loadId });
    if (!load) throw new ConvexError("Load not found.");
    const l = load.load;

    // If coordinates already exist, skip
    if (l.originLat != null && l.originLng != null && l.destinationLat != null && l.destinationLng != null) {
      return { success: true, message: "Coordinates already resolved." };
    }

    const originText = l.originAddress || l.origin;
    const destText = l.destAddress || l.destination;
    const patch: Record<string, unknown> = {};

    if (originText && (l.originLat == null || l.originLng == null)) {
      try {
        const originResult = await ctx.runAction(api.geocoding.geocodeAddress, { address: originText });
        if (originResult.results.length > 0) {
          const best = originResult.results[0];
          patch.originLat = best.latitude;
          patch.originLng = best.longitude;
          patch.originFormatted = best.formatted;
        }
      } catch (e) {
        console.error("[geocodeLoad] origin geocoding failed:", e);
      }
    }

    if (destText && (l.destinationLat == null || l.destinationLng == null)) {
      try {
        const destResult = await ctx.runAction(api.geocoding.geocodeAddress, { address: destText });
        if (destResult.results.length > 0) {
          const best = destResult.results[0];
          patch.destinationLat = best.latitude;
          patch.destinationLng = best.longitude;
          patch.destinationFormatted = best.formatted;
        }
      } catch (e) {
        console.error("[geocodeLoad] destination geocoding failed:", e);
      }
    }

    if (Object.keys(patch).length === 0) {
      return { success: false, message: "Could not resolve coordinates for this load's locations." };
    }

    await ctx.runMutation(api.geocoding.patchLoadCoords, {
      loadId: args.loadId,
      ...(patch.originLat != null && { originLat: patch.originLat as number }),
      ...(patch.originLng != null && { originLng: patch.originLng as number }),
      ...(patch.originFormatted != null && { originFormatted: patch.originFormatted as string }),
      ...(patch.destinationLat != null && { destinationLat: patch.destinationLat as number }),
      ...(patch.destinationLng != null && { destinationLng: patch.destinationLng as number }),
      ...(patch.destinationFormatted != null && { destinationFormatted: patch.destinationFormatted as string }),
    });

    return { success: true, message: "Location coordinates resolved." };
  },
});

// ---------------------------------------------------------------------------
// Query: geocodingStatus — check if geocoding is configured
// ---------------------------------------------------------------------------

export const geocodingStatus = query({
  args: {},
  handler: async () => {
    return { configured: !!process.env.GEOAPIFY_API_KEY };
  },
});
