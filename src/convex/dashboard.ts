import { query } from "./_generated/server";
import { loadScope, requireOrg } from "./lib/context";
import { TERMINAL_LOAD_STATUSES, LoadStatus } from "./constants";
import { requiresFinancialFiltering, getFinancialVisibility } from "./lib/visibility";

function tzToday(tz: string, dayOffset = 0): { start: number; end: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const start = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day) + dayOffset);
  return { start, end: start + 864e5 };
}

const DAY = 864e5;
/** Maximum records to load per entity table for dashboard aggregation.
 *  Bounds memory use regardless of org data volume. */
const BOUNDED = 500;

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    const tz = settings?.timezone ?? "UTC";
    const now = Date.now();
    const today = tzToday(tz);

    // Bounded queries — never load entire org data into memory
    const [carriers, trucks, drivers, loads, invoices, tasks, leads] = await Promise.all([
      ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("leads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
    ]);

    // Fetch only urgent messages (bounded) — not all messages
    const urgentMessages = (await ctx.db
      .query("messages")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .take(BOUNDED))
      .filter((m) => m.priority === "urgent" && ["unread", "needs_reply"].includes(m.status))
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5);

    // All messages for counts (bounded)
    const allMessages = (await ctx.db
      .query("messages")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .take(BOUNDED));

    // Scope by carrier/driver
    if (scope.carrierId) {
      const byCarrier = (l: { carrierId?: string }) => l.carrierId === scope.carrierId;
      loads.splice(0, loads.length, ...loads.filter(byCarrier));
      trucks.splice(0, trucks.length, ...trucks.filter(byCarrier));
      drivers.splice(0, drivers.length, ...drivers.filter(byCarrier));
      invoices.splice(0, invoices.length, ...invoices.filter(byCarrier));
    }
    if (scope.driverId) {
      loads.splice(0, loads.length, ...loads.filter((l) => l.driverId === scope.driverId));
    }

    const activeLoads = loads.filter((l) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus));
    const inTransit = loads.filter((l) => ["In Transit", "At Delivery"].includes(l.status));
    const delayed = activeLoads.filter((l) => l.deliveryDate && l.deliveryDate < now && l.status !== "Delivered" && l.status !== "POD Pending");
    const pickupsToday = loads.filter((l) => l.pickupDate && l.pickupDate >= today.start && l.pickupDate < today.end);
    const deliveriesToday = loads.filter((l) => l.deliveryDate && l.deliveryDate >= today.start && l.deliveryDate < today.end);

    const nonCancelled = loads.filter((l) => l.status !== "Cancelled");
    const grossBookedCents = nonCancelled.reduce((sum, l) => sum + (l.grossRateCents ?? 0), 0);
    const dispatcherRevenueCents = nonCancelled.reduce((sum, l) => sum + (l.feeCents ?? 0), 0);
    const overdueInvoices = invoices.filter((i) => {
      if (["Paid", "Cancelled"].includes(i.status)) return false;
      return i.dueDate ? i.dueDate < now : false;
    });
    const outstandingFeesCents = invoices.filter((i) => !["Paid", "Cancelled"].includes(i.status)).reduce((sum, i) => sum + (i.amountCents - i.paidCents), 0);
    const paidFeesCents = invoices.reduce((sum, i) => sum + i.paidCents, 0);

    // Attention items — only load documents for loads needing POD (bounded)
    const podLoads = loads.filter((l) => ["In Transit", "At Delivery", "Delivered", "POD Pending"].includes(l.status)).slice(0, 20);
    const missingPod: typeof loads = [];
    for (const l of podLoads) {
      const docs = await ctx.db.query("documents")
        .withIndex("by_org_entity", (q) => q.eq("orgId", s.orgId).eq("entityType", "load").eq("entityId", l._id))
        .take(10);
      if (!docs.some((d) => d.type === "POD")) missingPod.push(l);
      if (missingPod.length >= 5) break;
    }

    const upcomingPickups = loads
      .filter((l) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus) && l.pickupDate && l.pickupDate >= today.start && l.pickupDate <= today.start + 2 * DAY)
      .sort((a, b) => (a.pickupDate ?? 0) - (b.pickupDate ?? 0))
      .slice(0, 5);
    const upcomingDeliveries = loads
      .filter((l) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus) && l.deliveryDate && l.deliveryDate >= today.start && l.deliveryDate <= today.start + 2 * DAY)
      .sort((a, b) => (a.deliveryDate ?? 0) - (b.deliveryDate ?? 0))
      .slice(0, 5);
    const overdueTasks = tasks.filter((t) => t.status === "Pending" && t.dueAt && t.dueAt < now).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)).slice(0, 5);
    const expiringCarriers = carriers.filter((c) => c.insuranceExpiry && c.insuranceExpiry > now && c.insuranceExpiry < now + 30 * DAY);
    const expiringDrivers = drivers.filter((d) => (d.licenseExpiry && d.licenseExpiry < now + 30 * DAY) || (d.medicalCardExpiry && d.medicalCardExpiry < now + 30 * DAY));

    const dailySummaryText = [
      `${activeLoads.length} active load${activeLoads.length === 1 ? "" : "s"}`,
      `${inTransit.length} in transit`,
      `${pickupsToday.length} pickup${pickupsToday.length === 1 ? "" : "s"} today`,
      `${deliveriesToday.length} deliver${deliveriesToday.length === 1 ? "y" : "ies"} today`,
      `${trucks.filter((t) => t.availability === "Available").length} of ${trucks.length} trucks available`,
      `${urgentMessages.length} urgent message${urgentMessages.length === 1 ? "" : "s"}`,
      `${missingPod.length} load${missingPod.length === 1 ? "" : "s"} missing POD`,
      `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      `$${(dispatcherRevenueCents / 100).toFixed(2)} dispatcher revenue booked`,
      `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}`,
    ].join(" · ");

    // Trucks that need loads
    const trucksWithLoadIds = new Set(
      activeLoads.filter((l) => l.truckId).map((l) => l.truckId),
    );
    const trucksNeedingLoads = trucks
      .filter((t) => t.availability === "Available" && !trucksWithLoadIds.has(t._id))
      .map((t) => ({
        _id: t._id,
        unitNumber: t.unitNumber,
        type: t.type,
        carrierId: t.carrierId,
        currentLocation: t.currentLocation,
        lat: t.lat,
        lon: t.lon,
      }));

    // Client requests (urgent/needs_reply messages from carrier conversations)
    const clientRequests = allMessages
      .filter((m) => ["urgent", "high"].includes(m.priority ?? "") && ["needs_reply", "unread"].includes(m.status))
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5);

    const finance = {
      grossBookedCents,
      dispatcherRevenueCents,
      outstandingFeesCents,
      paidFeesCents,
      overdueInvoices: overdueInvoices.length,
      totalInvoiceCents: invoices.reduce((sum, i) => sum + i.amountCents, 0),
    };

    // Financial visibility: strip finance fields for carrier_scoped users
    if (requiresFinancialFiltering(s.role)) {
      const vis = await getFinancialVisibility(ctx, s.orgId);
      if (vis === "none") {
        finance.grossBookedCents = 0;
        finance.dispatcherRevenueCents = 0;
        finance.outstandingFeesCents = 0;
        finance.paidFeesCents = 0;
        finance.overdueInvoices = 0;
        finance.totalInvoiceCents = 0;
        clientRequests.length = 0;
      } else if (vis === "rate_only") {
        finance.dispatcherRevenueCents = 0;
        finance.outstandingFeesCents = 0;
        finance.paidFeesCents = 0;
        finance.overdueInvoices = 0;
      }
    }

    return {
      ops: {
        activeCarriers: carriers.filter((c) => c.status === "Active").length,
        totalCarriers: carriers.length,
        trucks: trucks.length,
        availableTrucks: trucks.filter((t) => t.availability === "Available").length,
        activeLoads: activeLoads.length,
        inTransit: inTransit.length,
        pickupsToday: pickupsToday.length,
        deliveriesToday: deliveriesToday.length,
        delayedLoads: delayed.length,
        urgentIssues: urgentMessages.length + missingPod.length + overdueTasks.length + overdueInvoices.length,
        availableDrivers: drivers.filter((d) => d.availability === "Available").length,
      },
      finance,
      attention: {
        urgentMessages,
        missingPod,
        upcomingPickups,
        upcomingDeliveries,
        overdueTasks,
        expiringCarriers,
        expiringDrivers,
        overdueInvoices: overdueInvoices.slice(0, 5),
      },
      upcoming: {
        pickups: loads.filter((l) => l.pickupDate && l.pickupDate >= today.start && l.pickupDate < today.start + 7 * DAY).sort((a, b) => (a.pickupDate ?? 0) - (b.pickupDate ?? 0)).slice(0, 10),
        deliveries: loads.filter((l) => l.deliveryDate && l.deliveryDate >= today.start && l.deliveryDate < today.start + 7 * DAY).sort((a, b) => (a.deliveryDate ?? 0) - (b.deliveryDate ?? 0)).slice(0, 10),
      },
      trucksNeedingLoads,
      clientRequests,
      dailySummaryText,
      demoMode: settings?.demoMode ?? false,
      empty: loads.length === 0 && carriers.length === 0 && leads.length === 0 && trucks.length === 0,
    };
  },
});
