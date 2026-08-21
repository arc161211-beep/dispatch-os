import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadScope, requireReportRole } from "./lib/context";
import { TERMINAL_LOAD_STATUSES, LoadStatus } from "./constants";
import { getFinancialVisibility, requiresFinancialFiltering } from "./lib/visibility";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Bounded collection — never loads more than 2000 records per table. */
const REPORT_LIMIT = 2000;
async function collectAll(ctx: any, table: string, orgId: string) {
  return (ctx.db.query(table).withIndex("by_org", (q: any) => q.eq("orgId", orgId)) as any).take(REPORT_LIMIT);
}

export const operations = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireReportRole(ctx);
    const scope = loadScope(s);
    const [loads, carriers, trucks, drivers, brokers] = await Promise.all([
      collectAll(ctx, "loads", s.orgId),
      collectAll(ctx, "carriers", s.orgId),
      collectAll(ctx, "trucks", s.orgId),
      collectAll(ctx, "drivers", s.orgId),
      collectAll(ctx, "brokers", s.orgId),
    ]);
    const from = args.from ?? 0;
    const to = args.to ?? Date.now();
    const scopedLoads = scope.carrierId ? loads.filter((l: any) => l.carrierId === scope.carrierId) : loads;
    const inRange = scopedLoads.filter((l: any) => l._creationTime >= from && l._creationTime <= to);

    const byStatus: Record<string, number> = {};
    for (const l of inRange) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;

    const completed = inRange.filter((l: any) => l.status === "Completed");
    const laneCount: Record<string, number> = {};
    for (const l of inRange) {
      if (l.origin && l.destination) {
        const lane = `${l.origin} → ${l.destination}`;
        laneCount[lane] = (laneCount[lane] ?? 0) + 1;
      }
    }
    const topLanes = Object.entries(laneCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([lane, count]) => ({ lane, count }));
    const avgRpm = completed.length
      ? round2(completed.reduce((sum: number, l: any) => sum + (l.rpm ?? 0), 0) / completed.length)
      : 0;

    return {
      loadsCreated: inRange.length,
      completedLoads: completed.length,
      cancelledLoads: inRange.filter((l: any) => l.status === "Cancelled").length,
      completionRate: inRange.length ? round2((completed.length / inRange.length) * 100) : 0,
      activeCarriers: carriers.filter((c: any) => c.status === "Active").length,
      activeLoads: scopedLoads.filter((l: any) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus)).length,
      trucks: trucks.filter((t: any) => (scope.carrierId ? t.carrierId === scope.carrierId : true)).length,
      availableTrucks: trucks.filter((t: any) => t.availability === "Available" && (scope.carrierId ? t.carrierId === scope.carrierId : true)).length,
      drivers: drivers.filter((d: any) => (scope.carrierId ? d.carrierId === scope.carrierId : true)).length,
      brokers: brokers.length,
      byStatus,
      topLanes,
      avgRpm,
    };
  },
});

export const financial = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireReportRole(ctx);
    const scope = loadScope(s);
    const [loads, invoices] = await Promise.all([collectAll(ctx, "loads", s.orgId), collectAll(ctx, "invoices", s.orgId)]);
    const from = args.from ?? 0;
    const to = args.to ?? Date.now();
    const scopedLoads = scope.carrierId ? loads.filter((l: any) => l.carrierId === scope.carrierId) : loads;
    const scopedInvoices = scope.carrierId ? invoices.filter((i: any) => i.carrierId === scope.carrierId) : invoices;
    const inRange = scopedLoads.filter((l: any) => l._creationTime >= from && l._creationTime <= to);

    const grossCents = inRange.filter((l: any) => l.status !== "Cancelled").reduce((sum: number, l: any) => sum + (l.grossRateCents ?? 0), 0);
    const feeCents = inRange.filter((l: any) => l.status !== "Cancelled").reduce((sum: number, l: any) => sum + (l.feeCents ?? 0), 0);
    const paidCents = scopedInvoices.filter((i: any) => i.issueDate >= from && i.issueDate <= to).reduce((sum: number, i: any) => sum + i.paidCents, 0);
    const unpaid = scopedInvoices.filter((i: any) => !["Paid", "Cancelled"].includes(i.status));
    const overdue = unpaid.filter((i: any) => i.dueDate && i.dueDate < Date.now());

    return {
      grossLoadRevenueCents: grossCents,
      dispatcherRevenueCents: feeCents,
      invoicedCents: unpaid.reduce((sum: number, i: any) => sum + i.amountCents, 0),
      paidCents,
      unpaidCents: unpaid.reduce((sum: number, i: any) => sum + (i.amountCents - i.paidCents), 0),
      overdueCents: overdue.reduce((sum: number, i: any) => sum + (i.amountCents - i.paidCents), 0),
      invoiceCount: scopedInvoices.length,
      overdueCount: overdue.length,
      invoiceByStatus: (scopedInvoices as any[]).reduce(
        (acc: Record<string, number>, i: any) => {
          acc[i.status] = (acc[i.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  },
});

export const crm = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireReportRole(ctx);
    const [leads, carriers] = await Promise.all([collectAll(ctx, "leads", s.orgId), collectAll(ctx, "carriers", s.orgId)]);
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const l of leads) {
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      bySource[l.source ?? "Manual"] = (bySource[l.source ?? "Manual"] ?? 0) + 1;
    }
    const converted = leads.filter((l: any) => l.convertedToCarrierId).length;
    return {
      totalLeads: leads.length,
      converted,
      conversionRate: leads.length ? round2((converted / leads.length) * 100) : 0,
      activeClients: carriers.filter((c: any) => c.status === "Active").length,
      lostClients: carriers.filter((c: any) => c.status === "Terminated").length,
      leadsByStatus: byStatus,
      leadsBySource: bySource,
    };
  },
});

export const dispatcher = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireReportRole(ctx);
    const scope = loadScope(s);
    const [loads, carriers, invoices] = await Promise.all([collectAll(ctx, "loads", s.orgId), collectAll(ctx, "carriers", s.orgId), collectAll(ctx, "invoices", s.orgId)]);
    const from = args.from ?? 0;
    const to = args.to ?? Date.now();
    const scopedLoads = scope.carrierId ? loads.filter((l: any) => l.carrierId === scope.carrierId) : loads;
    const inRange = scopedLoads.filter((l: any) => l._creationTime >= from && l._creationTime <= to);
    const completed = inRange.filter((l: any) => l.status === "Completed");

    const byCarrier: Record<string, { loads: number; grossCents: number; feeCents: number }> = {};
    for (const l of scopedLoads) {
      if (!l.carrierId) continue;
      const key = String(l.carrierId);
      byCarrier[key] = byCarrier[key] ?? { loads: 0, grossCents: 0, feeCents: 0 };
      byCarrier[key].loads++;
      byCarrier[key].grossCents += l.grossRateCents ?? 0;
      byCarrier[key].feeCents += l.feeCents ?? 0;
    }
    const carrierNames = new Map<string, string>();
    for (const c of carriers) carrierNames.set(String(c._id), c.companyName);
    const loadsPerCarrier = Object.entries(byCarrier)
      .map(([id, v2]) => ({ carrierId: id, carrierName: carrierNames.get(id) ?? "", ...v2 }))
      .sort((a, b) => b.loads - a.loads);

    return {
      loadsBooked: inRange.length,
      loadsCompleted: completed.length,
      avgRpm: completed.length ? round2(completed.reduce((sum: number, l: any) => sum + (l.rpm ?? 0), 0) / completed.length) : 0,
      avgLoadValueCents: inRange.length ? Math.round(inRange.reduce((sum: number, l: any) => sum + (l.grossRateCents ?? 0), 0) / inRange.length) : 0,
      dispatcherRevenueCents: inRange.filter((l: any) => l.status !== "Cancelled").reduce((sum: number, l: any) => sum + (l.feeCents ?? 0), 0),
      grossCents: inRange.filter((l: any) => l.status !== "Cancelled").reduce((sum: number, l: any) => sum + (l.grossRateCents ?? 0), 0),
      invoicedCents: invoices.filter((i: any) => i.issueDate >= from && i.issueDate <= to).reduce((sum: number, i: any) => sum + i.amountCents, 0),
      loadsPerCarrier,
    };
  },
});
