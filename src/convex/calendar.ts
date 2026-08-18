import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadScope, requireOrg } from "./lib/context";

export const events = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const [loads, tasks, invoices, carriers, drivers] = await Promise.all([
      ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
      ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect(),
    ]);

    const scopedLoads = scope.carrierId ? loads.filter((l) => l.carrierId === scope.carrierId) : loads.filter((l) => (scope.driverId ? l.driverId === scope.driverId : true));
    const events: {
      date: number;
      type: "pickup" | "delivery" | "task" | "invoice" | "expiration";
      title: string;
      link?: string;
      status?: string;
    }[] = [];

    for (const l of scopedLoads) {
      if (l.pickupDate && l.pickupDate >= args.from && l.pickupDate <= args.to) {
        events.push({ date: l.pickupDate, type: "pickup", title: `Pickup: ${l.loadNumber} — ${l.origin ?? "?"}`, link: `/loads/${l._id}`, status: l.status });
      }
      if (l.deliveryDate && l.deliveryDate >= args.from && l.deliveryDate <= args.to) {
        events.push({ date: l.deliveryDate, type: "delivery", title: `Delivery: ${l.loadNumber} — ${l.destination ?? "?"}`, link: `/loads/${l._id}`, status: l.status });
      }
    }

    const scopedTasks = scope.carrierId ? tasks.filter((t) => t.entityType === "carrier" && t.entityId === scope.carrierId) : tasks;
    for (const t of scopedTasks) {
      if (t.dueAt && t.dueAt >= args.from && t.dueAt <= args.to && t.status !== "Completed" && t.status !== "Cancelled") {
        events.push({ date: t.dueAt, type: "task", title: `${t.type}: ${t.title}`, link: "/tasks", status: t.priority });
      }
    }

    const scopedInvoices = scope.carrierId ? invoices.filter((i) => i.carrierId === scope.carrierId) : invoices;
    for (const i of scopedInvoices) {
      if (i.dueDate && i.dueDate >= args.from && i.dueDate <= args.to && !["Paid", "Cancelled"].includes(i.status)) {
        events.push({ date: i.dueDate, type: "invoice", title: `Invoice due: ${i.invoiceNumber} — $${(i.amountCents / 100).toFixed(2)}`, link: "/finance", status: i.status });
      }
    }

    const scopedCarriers = scope.carrierId ? carriers.filter((c) => c._id === scope.carrierId) : carriers;
    for (const c of scopedCarriers) {
      if (c.insuranceExpiry && c.insuranceExpiry >= args.from && c.insuranceExpiry <= args.to) {
        events.push({ date: c.insuranceExpiry, type: "expiration", title: `Insurance expires: ${c.companyName}`, link: `/carriers/${c._id}` });
      }
    }
    const scopedDrivers = scope.carrierId ? drivers.filter((d) => d.carrierId === scope.carrierId) : drivers;
    for (const d of scopedDrivers) {
      for (const [field, label] of [
        ["licenseExpiry", "license"],
        ["medicalCardExpiry", "medical card"],
      ] as const) {
        const v2 = d[field];
        if (v2 && v2 >= args.from && v2 <= args.to) {
          events.push({ date: v2, type: "expiration", title: `${label} expires: ${d.name}`, link: "/drivers" });
        }
      }
    }

    events.sort((a, b) => a.date - b.date);
    return events;
  },
});
