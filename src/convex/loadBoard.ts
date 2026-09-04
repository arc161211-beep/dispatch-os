// ---------------------------------------------------------------------------
// TrukTek public Load Board integration for DispatchOS.
//
// Searches loads via the official public TrukTek REST endpoint and returns
// results for display in the Load Board page.
//
// SECURITY: The TrukTek endpoint is public and requires no API key.
// All calls happen server-side through Convex actions.
// ---------------------------------------------------------------------------

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, mutation, query, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { requireOrg, requireWrite, Session } from "./lib/context";
import { audit } from "./lib/audit";

// ---------------------------------------------------------------------------
// Auth helper (mirrors ai.ts / routing.ts pattern)
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
// TrukTek API types
// ---------------------------------------------------------------------------

interface TrukTekLoad {
  loadId: string;
  octy: string;           // origin city
  ost: string;            // origin state
  dcty: string;           // destination city
  dst: string;            // destination state
  equip: string;          // Van | Reefer | Flatbed | Tanker | Intermodal | Auto
  ratePay: number;        // rate in dollars
  pickupDate: string;     // ISO date
  deliveryDate: string;   // ISO date
  shipperNm: string;      // shipper/broker name
  weight: number;         // weight in lbs
  length?: number;        // trailer length
  coordinates: [number, number][];  // [lng, lat] pairs
  loadDist: number;       // loaded miles
  loadHours: number;      // driving hours
  o2oDist: number;        // origin-to-origin distance (deadhead)
  d2dDist: number;        // destination-to-destination distance
  extraDist: number;      // extra distance
  extraHours: number;     // extra hours
  lohDiff: number;        // load over head difference
  grossRpm: number;       // gross revenue per mile
}

// ---------------------------------------------------------------------------
// Search args
// ---------------------------------------------------------------------------

export const searchArgs = v.object({
  originCity: v.optional(v.string()),
  originState: v.optional(v.string()),
  destCity: v.optional(v.string()),
  destState: v.optional(v.string()),
  equipment: v.optional(v.string()),
  pickupDate: v.optional(v.string()),
  deliveryDate: v.optional(v.string()),
  minRpm: v.optional(v.number()),
  maxDeadhead: v.optional(v.number()),
});

export type SearchArgs = typeof searchArgs.type;

// ---------------------------------------------------------------------------
// Normalized result type returned to frontend
// ---------------------------------------------------------------------------

export interface LoadBoardLoad {
  loadId: string;
  origin: string;          // "Dallas, TX"
  destination: string;     // "Atlanta, GA"
  equipment: string;
  ratePay: number;
  pickupDate: string;
  deliveryDate: string;
  shipperNm: string;
  weight: number;
  length?: number;
  miles: number;
  hours: number;
  deadheadMiles: number;
  grossRpm: number;
  coordinates: [number, number][];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Search loads on the TrukTek public load board. */
export const searchLoads = action({
  args: searchArgs,
  handler: async (ctx, args): Promise<{ loads: LoadBoardLoad[]; error?: string }> => {
    await getSessionForAction(ctx);

    // Build query params — only include non-empty values
    const params = new URLSearchParams();
    if (args.originCity?.trim()) params.set("octy", args.originCity.trim());
    if (args.originState?.trim()) params.set("ost", args.originState.trim().toUpperCase());
    if (args.destCity?.trim()) params.set("dcty", args.destCity.trim());
    if (args.destState?.trim()) params.set("dst", args.destState.trim().toUpperCase());
    if (args.equipment?.trim()) params.set("freight", args.equipment.trim());
    if (args.pickupDate?.trim()) params.set("pickupDate", args.pickupDate.trim());
    if (args.deliveryDate?.trim()) params.set("deliveryDate", args.deliveryDate.trim());

    const url = `https://www.truktek.com/api/loads?${params.toString()}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[loadBoard] TrukTek API error (${res.status}):`, errText.slice(0, 200));
        if (res.status === 429) {
          return { loads: [], error: "Rate limited by TrukTek. Please wait a moment and try again." };
        }
        return { loads: [], error: `TrukTek returned status ${res.status}. Please try again.` };
      }

      const data = (await res.json()) as { loads?: TrukTekLoad[] };
      let loads: TrukTekLoad[] = data.loads ?? [];

      // Client-side filtering for fields the API doesn't filter
      if (args.minRpm && args.minRpm > 0) {
        loads = loads.filter((l) => l.grossRpm >= args.minRpm!);
      }
      if (args.maxDeadhead && args.maxDeadhead > 0) {
        loads = loads.filter((l) => l.o2oDist <= args.maxDeadhead!);
      }

      // Map to normalized result type
      const result: LoadBoardLoad[] = loads.map((l) => ({
        loadId: l.loadId,
        origin: `${l.octy}, ${l.ost}`,
        destination: `${l.dcty}, ${l.dst}`,
        equipment: l.equip,
        ratePay: l.ratePay,
        pickupDate: l.pickupDate,
        deliveryDate: l.deliveryDate,
        shipperNm: l.shipperNm,
        weight: l.weight,
        length: l.length,
        miles: l.loadDist,
        hours: l.loadHours,
        deadheadMiles: l.o2oDist,
        grossRpm: l.grossRpm,
        coordinates: l.coordinates ?? [],
      }));

      return { loads: result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[loadBoard] TrukTek request failed:", msg);
      if (msg.includes("timeout") || msg.includes("abort")) {
        return { loads: [], error: "Request timed out. Please try again." };
      }
      return { loads: [], error: "Failed to reach TrukTek. Please check your connection." };
    }
  },
});

// ---------------------------------------------------------------------------
// Save a TrukTek load into DispatchOS (after explicit user confirmation)
// ---------------------------------------------------------------------------

export const saveLoad = mutation({
  args: {
    externalId: v.string(),
    origin: v.string(),
    destination: v.string(),
    equipment: v.optional(v.string()),
    grossRateCents: v.number(),
    pickupDate: v.optional(v.number()),
    deliveryDate: v.optional(v.number()),
    loadedMiles: v.optional(v.number()),
    deadheadMiles: v.optional(v.number()),
    weight: v.optional(v.number()),
    shipperName: v.optional(v.string()),
    notes: v.optional(v.string()),
    originLat: v.optional(v.number()),
    originLng: v.optional(v.number()),
    destinationLat: v.optional(v.number()),
    destinationLng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);

    // Check for duplicate external loads
    const existing = await ctx.db
      .query("loads")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .filter((q) => q.eq(q.field("externalId"), args.externalId))
      .first();

    if (existing) {
      throw new ConvexError("This load is already saved in DispatchOS.");
    }

    const loadNumber = `LB-${Date.now().toString(36).toUpperCase()}`;

    const id = await ctx.db.insert("loads", {
      orgId: s.orgId,
      loadNumber,
      status: "Offered",
      externalId: args.externalId,
      origin: args.origin,
      destination: args.destination,
      equipment: args.equipment,
      grossRateCents: args.grossRateCents,
      pickupDate: args.pickupDate,
      deliveryDate: args.deliveryDate,
      loadedMiles: args.loadedMiles,
      deadheadMiles: args.deadheadMiles,
      weight: args.weight,
      source: "manual",
      originLat: args.originLat,
      originLng: args.originLng,
      destinationLat: args.destinationLat,
      destinationLng: args.destinationLng,
      notes: args.notes ? `Imported from TrukTek Load Board. ${args.notes}` : "Imported from TrukTek Load Board.",
    });

    await audit(ctx, s, {
      action: "load.created",
      entity: "load",
      entityId: id,
      metadata: { source: "loadBoard", externalId: args.externalId, loadNumber },
    });

    return { id, loadNumber };
  },
});

/** Check if a TrukTek load has already been saved. */
export const checkSaved = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);

    const existing = await ctx.db
      .query("loads")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .filter((q) => q.eq(q.field("externalId"), args.externalId))
      .first();

    return { saved: !!existing, loadId: existing?._id };
  },
});
