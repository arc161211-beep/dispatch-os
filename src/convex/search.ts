import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadScope, requireOrg } from "./lib/context";

export const globalSearch = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const q = args.term.trim().toLowerCase();
    const limit = args.limit ?? 8;
    if (q.length < 2) return [];

    const results: { type: string; label: string; sub: string; id: string; route: string }[] = [];

    const carriers = (await ctx.db.query("carriers").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect()).filter((c) =>
      scope.carrierId ? c._id === scope.carrierId : true,
    );
    for (const c of carriers) {
      if (c.companyName.toLowerCase().includes(q) || (c.mcNumber ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Carrier", label: c.companyName, sub: [c.mcNumber, c.status].filter(Boolean).join(" · "), id: c._id, route: `/carriers/${c._id}` });
        if (results.length >= limit) break;
      }
    }

    const trucks = (await ctx.db.query("trucks").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect()).filter((t) =>
      scope.carrierId ? t.carrierId === scope.carrierId : true,
    );
    for (const t of trucks) {
      if (t.unitNumber.toLowerCase().includes(q) || (t.vin ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Truck", label: `${t.unitNumber} (${t.type ?? "truck"})`, sub: `${t.currentLocation ?? "no location"} · ${t.availability}`, id: t._id, route: "/trucks" });
        if (results.length >= limit) break;
      }
    }

    const drivers = (await ctx.db.query("drivers").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect()).filter((d) =>
      scope.carrierId ? d.carrierId === scope.carrierId : true,
    );
    for (const d of drivers) {
      if (d.name.toLowerCase().includes(q) || (d.phone ?? "").includes(q)) {
        results.push({ type: "Driver", label: d.name, sub: `${d.availability}`, id: d._id, route: "/drivers" });
        if (results.length >= limit) break;
      }
    }

    const brokers = await ctx.db.query("brokers").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect();
    for (const b of brokers) {
      if (b.company.toLowerCase().includes(q) || (b.mc ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Broker", label: b.company, sub: [b.mc, b.status].filter(Boolean).join(" · "), id: b._id, route: "/brokers" });
        if (results.length >= limit) break;
      }
    }

    const leads = await ctx.db.query("leads").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect();
    for (const l of leads) {
      if (l.companyName.toLowerCase().includes(q) || (l.contactName ?? "").toLowerCase().includes(q)) {
        results.push({ type: "Lead", label: l.companyName, sub: `${l.status}`, id: l._id, route: "/leads" });
        if (results.length >= limit) break;
      }
    }

    const loads = (await ctx.db.query("loads").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect()).filter((l) =>
      scope.driverId ? l.driverId === scope.driverId : scope.carrierId ? l.carrierId === scope.carrierId : true,
    );
    for (const l of loads) {
      if (
        l.loadNumber.toLowerCase().includes(q) ||
        (l.origin ?? "").toLowerCase().includes(q) ||
        (l.destination ?? "").toLowerCase().includes(q) ||
        (l.externalId ?? "").toLowerCase().includes(q)
      ) {
        results.push({ type: "Load", label: l.loadNumber, sub: `${l.origin ?? "?"} → ${l.destination ?? "?"} · ${l.status}`, id: l._id, route: `/loads/${l._id}` });
        if (results.length >= limit) break;
      }
    }

    const invoices = (await ctx.db.query("invoices").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect()).filter((i) =>
      scope.carrierId ? i.carrierId === scope.carrierId : true,
    );
    for (const i of invoices) {
      if (i.invoiceNumber.toLowerCase().includes(q)) {
        results.push({ type: "Invoice", label: i.invoiceNumber, sub: `$${(i.amountCents / 100).toFixed(2)} · ${i.status}`, id: i._id, route: "/finance" });
        if (results.length >= limit) break;
      }
    }

    if (results.length < limit) {
      const msgs = await ctx.db.query("messages").withIndex("by_org", (q2) => q2.eq("orgId", s.orgId)).collect();
      for (const m of msgs) {
        if (m.body.toLowerCase().includes(q)) {
          results.push({ type: "Message", label: m.body.slice(0, 60), sub: `${m.direction} · ${m.status}`, id: m._id, route: "/messages" });
          if (results.length >= limit) break;
        }
      }
    }

    return results;
  },
});
