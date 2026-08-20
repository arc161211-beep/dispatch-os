import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadScope, requireOrg } from "./lib/context";
import { filterLoadFinancials, getFinancialVisibility, requiresFinancialFiltering } from "./lib/visibility";

/** Max records to scan per entity type before stopping. */
const SCAN_LIMIT = 100;

export const globalSearch = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const q = args.term.trim().toLowerCase();
    const limit = args.limit ?? 8;
    if (q.length < 2) return [];

    const results: { type: string; label: string; sub: string; id: string; route: string }[] = [];

    // Load financial visibility once for efficiency
    let visMode: "full" | "rate_only" | "fee_visible" | "none" | undefined;
    if (requiresFinancialFiltering(s.role)) {
      visMode = await getFinancialVisibility(ctx, s.orgId);
    }

    // Early termination: stop scanning each entity once we have enough results
    const carriers = await ctx.db.query("carriers").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const c of carriers) {
      if (scope.carrierId && c._id !== scope.carrierId) continue;
      if (c.companyName.toLowerCase().includes(q) || (c.mcNumber ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Carrier", label: c.companyName, sub: [c.mcNumber, c.status].filter(Boolean).join(" · "), id: c._id, route: `/carriers/${c._id}` });
        if (results.length >= limit) return results;
      }
    }

    const trucks = await ctx.db.query("trucks").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const t of trucks) {
      if (scope.carrierId && t.carrierId !== scope.carrierId) continue;
      if (t.unitNumber.toLowerCase().includes(q) || (t.vin ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Truck", label: `${t.unitNumber} (${t.type ?? "truck"})`, sub: `${t.currentLocation ?? "no location"} · ${t.availability}`, id: t._id, route: "/trucks" });
        if (results.length >= limit) return results;
      }
    }

    const drivers = await ctx.db.query("drivers").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const d of drivers) {
      if (scope.carrierId && d.carrierId !== scope.carrierId) continue;
      if (d.name.toLowerCase().includes(q) || (d.phone ?? "").includes(q)) {
        results.push({ type: "Driver", label: d.name, sub: `${d.availability}`, id: d._id, route: "/drivers" });
        if (results.length >= limit) return results;
      }
    }

    const brokers = await ctx.db.query("brokers").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const b of brokers) {
      if (b.company.toLowerCase().includes(q) || (b.mc ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Broker", label: b.company, sub: [b.mc, b.status].filter(Boolean).join(" · "), id: b._id, route: "/brokers" });
        if (results.length >= limit) return results;
      }
    }

    const leads = await ctx.db.query("leads").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const l of leads) {
      if (l.companyName.toLowerCase().includes(q) || (l.contactName ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Lead", label: l.companyName, sub: `${l.status}`, id: l._id, route: "/leads" });
        if (results.length >= limit) return results;
      }
    }

    const loads = await ctx.db.query("loads").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const l of loads) {
      if (scope.driverId && l.driverId !== scope.driverId) continue;
      if (scope.carrierId && l.carrierId !== scope.carrierId) continue;
      if (
        l.loadNumber.toLowerCase().includes(q) ||
        (l.origin ?? "").toLowerCase().includes(q) ||
        (l.destination ?? "").toLowerCase().includes(q) ||
        (l.externalId ?? "").toLowerCase().includes(q)
      ) {
        // Financial visibility: filter financial fields from search results
        const display = visMode ? filterLoadFinancials(l, visMode) : l;
        results.push({ type: "Load", label: l.loadNumber, sub: `${l.origin ?? "?"} → ${l.destination ?? "?"} · ${l.status}`, id: l._id, route: `/loads/${l._id}` });
        if (results.length >= limit) return results;
      }
    }

    const invoices = await ctx.db.query("invoices").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
    for (const i of invoices) {
      if (scope.carrierId && i.carrierId !== scope.carrierId) continue;
      if (i.invoiceNumber.toLowerCase().includes(q)) {
        // Financial visibility: hide payment details for restricted carriers
        const amountDisplay = visMode === "none" ? "•••" : `$${(i.amountCents / 100).toFixed(2)}`;
        results.push({ type: "Invoice", label: i.invoiceNumber, sub: `${amountDisplay} · ${i.status}`, id: i._id, route: "/finance" });
        if (results.length >= limit) return results;
      }
    }

    if (results.length < limit) {
      const msgs = await ctx.db.query("messages").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).take(SCAN_LIMIT);
      for (const m of msgs) {
        if (m.body.toLowerCase().includes(q)) {
          results.push({ type: "Message", label: m.body.slice(0, 60), sub: `${m.direction} · ${m.status}`, id: m._id, route: "/messages" });
          if (results.length >= limit) return results;
        }
      }
    }

    return results;
  },
});
