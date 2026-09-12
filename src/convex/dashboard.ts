import { query, mutation } from "./_generated/server";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
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

    // PHASE 7: At-risk and delayed loads for attention indicators
    const atRiskLoads = activeLoads.filter((l) => l.deliveryRisk === "at_risk").slice(0, 5);
    const delayedLoadsAtRisk = activeLoads.filter((l) => l.deliveryRisk === "delayed").slice(0, 5);
    const staleGpsTrucks = trucks.filter((t) => t.trackingActive && t.lastLocationUpdateAt && now - t.lastLocationUpdateAt > 30 * 60 * 1000).slice(0, 5);
    const pendingOffers = activeLoads.filter((l) => l.offerStatus === "pending").slice(0, 5);

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
        atRiskLoads,
        delayedLoads: delayedLoadsAtRisk,
        staleGpsTrucks,
        pendingOffers,
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

// ---------------------------------------------------------------------------
// PHASE 8: Attention Items with Severity Levels
//
// Returns a prioritized list of items requiring dispatcher attention.
// Each item has a severity (critical/high/medium/low), category, title,
// description, link, and timestamp. The UI can render these as a prioritized
// work queue.
// ---------------------------------------------------------------------------

interface AttentionItem {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  timestamp: number;
}

export const getAttentionItems = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    const tz = settings?.timezone ?? "UTC";
    const now = Date.now();
    const today = tzToday(tz);
    const items: AttentionItem[] = [];

    // Bounded queries
    const [loads, trucks, tasks, invoices] = await Promise.all([
      ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
    ]);

    // Scope by carrier/driver
    let scopedLoads = loads;
    let scopedTrucks = trucks;
    if (scope.carrierId) {
      scopedLoads = loads.filter((l) => l.carrierId === scope.carrierId);
      scopedTrucks = trucks.filter((t) => t.carrierId === scope.carrierId);
    }
    if (scope.driverId) {
      scopedLoads = scopedLoads.filter((l) => l.driverId === scope.driverId);
    }

    const activeLoads = scopedLoads.filter((l) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus));

    // === CRITICAL: Delayed loads ===
    for (const load of activeLoads.filter((l) => l.deliveryRisk === "delayed")) {
      items.push({
        severity: "critical",
        category: "delayed_load",
        title: `Load ${load.loadNumber} is DELAYED`,
        description: `Estimated ${load.delayMinutes ?? 0} min late. Required: ${load.deliveryDate ? new Date(load.deliveryDate).toLocaleString() : "unknown"}`,
        link: `/loads/${load._id}`,
        entityType: "load",
        entityId: load._id,
        timestamp: load.etaUpdatedAt ?? now,
      });
    }

    // === CRITICAL: Overdue invoices ===
    for (const inv of invoices.filter((i) => !["Paid", "Cancelled"].includes(i.status) && i.dueDate && i.dueDate < now)) {
      items.push({
        severity: "critical",
        category: "overdue_invoice",
        title: `Invoice overdue: ${inv.invoiceNumber}`,
        description: `$${((inv.amountCents - inv.paidCents) / 100).toFixed(2)} outstanding. Due: ${new Date(inv.dueDate!).toLocaleDateString()}`,
        link: `/finance`,
        entityType: "invoice",
        entityId: inv._id,
        timestamp: inv.dueDate!,
      });
    }

    // === HIGH: At-risk loads ===
    for (const load of activeLoads.filter((l) => l.deliveryRisk === "at_risk")) {
      items.push({
        severity: "high",
        category: "at_risk_load",
        title: `Load ${load.loadNumber} at risk of being late`,
        description: `ETA: ${load.eta ? new Date(load.eta).toLocaleString() : "unknown"}. Required: ${load.deliveryDate ? new Date(load.deliveryDate).toLocaleString() : "unknown"}`,
        link: `/loads/${load._id}`,
        entityType: "load",
        entityId: load._id,
        timestamp: load.etaUpdatedAt ?? now,
      });
    }

    // === HIGH: Stale GPS on active/transit loads ===
    for (const truck of scopedTrucks.filter((t) => t.trackingActive && t.lastLocationUpdateAt && now - t.lastLocationUpdateAt > 30 * 60 * 1000)) {
      const staleMinutes = Math.round((now - (truck.lastLocationUpdateAt ?? 0)) / 60000);
      const linkedLoad = activeLoads.find((l) => l.truckId === truck._id);
      items.push({
        severity: "high",
        category: "stale_gps",
        title: `Truck ${truck.unitNumber} GPS stale`,
        description: `Last update ${staleMinutes} min ago${linkedLoad ? `. Active load: ${linkedLoad.loadNumber}` : ""}`,
        link: `/trucks/${truck._id}`,
        entityType: "truck",
        entityId: truck._id,
        timestamp: truck.lastLocationUpdateAt ?? 0,
      });
    }

    // === HIGH: Missing POD after delivery ===
    const deliveredLoads = scopedLoads.filter((l) => ["Delivered", "POD Pending"].includes(l.status)).slice(0, 20);
    for (const load of deliveredLoads) {
      const docs = await ctx.db.query("documents")
        .withIndex("by_org_entity", (q) => q.eq("orgId", s.orgId).eq("entityType", "load").eq("entityId", load._id))
        .take(10);
      if (!docs.some((d) => d.type === "POD")) {
        items.push({
          severity: "high",
          category: "missing_pod",
          title: `POD missing for ${load.loadNumber}`,
          description: `Load delivered but no proof of delivery on file.`,
          link: `/loads/${load._id}`,
          entityType: "load",
          entityId: load._id,
          timestamp: load._creationTime,
        });
      }
    }

    // === MEDIUM: Pending driver offers ===
    for (const load of activeLoads.filter((l) => l.offerStatus === "pending")) {
      items.push({
        severity: "medium",
        category: "pending_offer",
        title: `Offer pending: ${load.loadNumber}`,
        description: `${load.origin ?? "?"} → ${load.destination ?? "?"}. Awaiting driver acceptance.`,
        link: `/loads/${load._id}`,
        entityType: "load",
        entityId: load._id,
        timestamp: load._creationTime,
      });
    }

    // === MEDIUM: Upcoming pickups (within 24h) ===
    for (const load of activeLoads.filter((l) =>
      l.pickupDate && l.pickupDate >= now && l.pickupDate <= now + DAY
    ).sort((a, b) => (a.pickupDate ?? 0) - (b.pickupDate ?? 0)).slice(0, 10)) {
      const hoursUntil = Math.round(((load.pickupDate ?? 0) - now) / 3600000);
      items.push({
        severity: "medium",
        category: "upcoming_pickup",
        title: `Pickup in ${hoursUntil}h: ${load.loadNumber}`,
        description: `${load.origin ?? "?"} at ${load.pickupDate ? new Date(load.pickupDate).toLocaleTimeString() : "?"}`,
        link: `/loads/${load._id}`,
        entityType: "load",
        entityId: load._id,
        timestamp: load.pickupDate!,
      });
    }

    // === MEDIUM: Overdue tasks ===
    for (const task of tasks.filter((t) => t.status === "Pending" && t.dueAt && t.dueAt < now)) {
      items.push({
        severity: "medium",
        category: "overdue_task",
        title: `Overdue task: ${task.title}`,
        description: `Due: ${task.dueAt ? new Date(task.dueAt).toLocaleString() : "unknown"}`,
        entityType: "task",
        entityId: task._id,
        timestamp: task.dueAt ?? task._creationTime,
      });
    }

    // === LOW: Upcoming deliveries (24–48h) ===
    for (const load of activeLoads.filter((l) =>
      l.deliveryDate && l.deliveryDate > now + DAY && l.deliveryDate <= now + 2 * DAY
    ).sort((a, b) => (a.deliveryDate ?? 0) - (b.deliveryDate ?? 0)).slice(0, 5)) {
      const hoursUntil = Math.round(((load.deliveryDate ?? 0) - now) / 3600000);
      items.push({
        severity: "low",
        category: "upcoming_delivery",
        title: `Delivery in ${hoursUntil}h: ${load.loadNumber}`,
        description: `${load.destination ?? "?"} at ${load.deliveryDate ? new Date(load.deliveryDate).toLocaleTimeString() : "?"}`,
        link: `/loads/${load._id}`,
        entityType: "load",
        entityId: load._id,
        timestamp: load.deliveryDate!,
      });
    }

    // === LOW: Trucks needing loads ===
    const trucksWithLoad = new Set(activeLoads.filter((l) => l.truckId).map((l) => l.truckId));
    const idleTrucks = scopedTrucks.filter((t) => t.availability === "Available" && !trucksWithLoad.has(t._id));
    if (idleTrucks.length > 0) {
      items.push({
        severity: "low",
        category: "idle_trucks",
        title: `${idleTrucks.length} truck${idleTrucks.length === 1 ? "" : "s"} without loads`,
        description: "Available trucks could be assigned to new loads.",
        link: `/trucks`,
        timestamp: now,
      });
    }

    // Sort by severity (critical first) then by timestamp (newest first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => {
      const sv = severityOrder[a.severity] - severityOrder[b.severity];
      if (sv !== 0) return sv;
      return b.timestamp - a.timestamp;
    });

    return items;
  },
});

// ---------------------------------------------------------------------------
// PHASE 8: Daily Operational Summary
//
// Returns a structured summary of today's operations for display in the
// dashboard or for AI consumption. Includes all key operational metrics.
// ---------------------------------------------------------------------------

export const getOperationalSummary = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    const tz = settings?.timezone ?? "UTC";
    const now = Date.now();
    const today = tzToday(tz);

    const [loads, trucks, drivers] = await Promise.all([
      ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
      ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(BOUNDED),
    ]);

    // Scope
    let scopedLoads = loads;
    let scopedTrucks = trucks;
    let scopedDrivers = drivers;
    if (scope.carrierId) {
      scopedLoads = loads.filter((l) => l.carrierId === scope.carrierId);
      scopedTrucks = trucks.filter((t) => t.carrierId === scope.carrierId);
      scopedDrivers = drivers.filter((d) => d.carrierId === scope.carrierId);
    }
    if (scope.driverId) {
      scopedLoads = scopedLoads.filter((l) => l.driverId === scope.driverId);
    }

    const activeLoads = scopedLoads.filter((l) => !TERMINAL_LOAD_STATUSES.includes(l.status as LoadStatus));
    const inTransit = scopedLoads.filter((l) => ["In Transit", "At Delivery"].includes(l.status));
    const completedToday = scopedLoads.filter((l) =>
      ["Delivered", "Completed"].includes(l.status) &&
      l._creationTime >= today.start && l._creationTime < today.end
    );

    const delayedLoads = activeLoads.filter((l) => l.deliveryRisk === "delayed");
    const atRiskLoads = activeLoads.filter((l) => l.deliveryRisk === "at_risk");
    const pendingOffers = activeLoads.filter((l) => l.offerStatus === "pending");
    const staleGpsTrucks = scopedTrucks.filter((t) =>
      t.trackingActive && t.lastLocationUpdateAt && now - t.lastLocationUpdateAt > 30 * 60 * 1000
    );

    return {
      timestamp: now,
      timezone: tz,
      summary: {
        activeLoads: activeLoads.length,
        inTransit: inTransit.length,
        completedToday: completedToday.length,
        delayedLoads: delayedLoads.length,
        atRiskLoads: atRiskLoads.length,
        pendingOffers: pendingOffers.length,
        totalTrucks: scopedTrucks.length,
        availableTrucks: scopedTrucks.filter((t) => t.availability === "Available").length,
        totalDrivers: scopedDrivers.length,
        availableDrivers: scopedDrivers.filter((d) => d.availability === "Available").length,
        staleGpsTrucks: staleGpsTrucks.length,
      },
      delayedLoadNumbers: delayedLoads.map((l) => l.loadNumber),
      atRiskLoadNumbers: atRiskLoads.map((l) => l.loadNumber),
      pendingOfferNumbers: pendingOffers.map((l) => l.loadNumber),
      staleGpsTruckNumbers: staleGpsTrucks.map((t) => t.unitNumber),
    };
  },
});

// ---------------------------------------------------------------------------
// PHASE 12: Proactive Operations Scan
//
// Admin/dispatcher-triggered scan that checks for operational issues and
// sends notifications for problems that need attention. Designed to be called
// periodically (e.g. via Convex cron or manually from the dashboard).
//
// Idempotent: uses 24-hour deduplication window on notification titles
// to prevent spam. Safe to call repeatedly.
// ---------------------------------------------------------------------------

export const proactiveScan = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    const now = Date.now();
    const DAY = 86_400_000;
    const scanned: string[] = [];
    let notificationsSent = 0;

    // Helper: check if a similar notification was sent in the last 24 hours
    async function wasRecentlyNotified(titlePrefix: string): Promise<boolean> {
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
        .order("desc")
        .take(30);
      return recent.some((n) => n.title.startsWith(titlePrefix) && now - n._creationTime < DAY);
    }

    // 1. OVERDUE INVOICES
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .take(200);
    const overdue = invoices.filter(
      (i) => !["Paid", "Cancelled"].includes(i.status) && i.dueDate && i.dueDate < now
    );
    if (overdue.length > 0 && !(await wasRecentlyNotified("💰 Overdue invoices"))) {
      const totalOutstanding = overdue.reduce((sum, i) => sum + (i.amountCents - i.paidCents), 0);
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `💰 ${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""}`,
        body: `Outstanding balance: $${(totalOutstanding / 100).toFixed(2)}. Oldest: ${overdue[0].invoiceNumber}.`,
        link: "/finance",
        type: "finance",
      });
      notificationsSent++;
    }
    scanned.push("overdue_invoices");

    // 2. EXPIRING DRIVER DOCUMENTS (license, medical card within 30 days)
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .take(200);
    const expiringDrivers = drivers.filter((d) => {
      const licenseExpiry = d.licenseExpiry ?? 0;
      const medicalExpiry = d.medicalCardExpiry ?? 0;
      return (licenseExpiry > 0 && licenseExpiry < now + 30 * DAY) ||
             (medicalExpiry > 0 && medicalExpiry < now + 30 * DAY);
    });
    if (expiringDrivers.length > 0 && !(await wasRecentlyNotified("⚠️ Driver compliance"))) {
      const names = expiringDrivers.slice(0, 3).map((d) => d.name).join(", ");
      const suffix = expiringDrivers.length > 3 ? ` and ${expiringDrivers.length - 3} more` : "";
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `⚠️ ${expiringDrivers.length} driver${expiringDrivers.length > 1 ? "s" : ""} with expiring documents`,
        body: `${names}${suffix} — license or medical card expiring within 30 days.`,
        link: "/drivers",
        type: "document",
      });
      notificationsSent++;
    }
    scanned.push("driver_compliance");

    // 3. STALE GPS (tracking-active trucks with no update in 1 hour)
    const trucks = await ctx.db
      .query("trucks")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .take(200);
    const staleTrucks = trucks.filter(
      (t) => t.trackingActive && t.lastLocationUpdateAt && now - t.lastLocationUpdateAt > 60 * 60 * 1000
    );
    if (staleTrucks.length > 0 && !(await wasRecentlyNotified("📡 Stale GPS"))) {
      const units = staleTrucks.slice(0, 3).map((t) => t.unitNumber).join(", ");
      const suffix = staleTrucks.length > 3 ? ` and ${staleTrucks.length - 3} more` : "";
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `📡 ${staleTrucks.length} truck${staleTrucks.length > 1 ? "s" : ""} with stale GPS`,
        body: `Truck${staleTrucks.length > 1 ? "s" : ""} ${units}${suffix} — no GPS update in over 1 hour.`,
        link: "/truck-map",
        type: "location",
      });
      notificationsSent++;
    }
    scanned.push("stale_gps");

    // 4. LOADS PENDING DRIVER OFFER TOO LONG (>24h with pending offer)
    const loads = await ctx.db
      .query("loads")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .take(500);
    const staleOffers = loads.filter((l) =>
      l.offerStatus === "pending" &&
      l.driverId &&
      l._creationTime < now - DAY
    );
    if (staleOffers.length > 0 && !(await wasRecentlyNotified("⏰ Pending driver offers"))) {
      const nums = staleOffers.slice(0, 3).map((l) => l.loadNumber).join(", ");
      const suffix = staleOffers.length > 3 ? ` and ${staleOffers.length - 3} more` : "";
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `⏰ ${staleOffers.length} load${staleOffers.length > 1 ? "s" : ""} with pending driver offer`,
        body: `${nums}${suffix} — driver has not responded in over 24 hours.`,
        link: "/loads",
        type: "load",
      });
      notificationsSent++;
    }
    scanned.push("pending_offers");

    // 5. DELIVERED LOADS WITHOUT POD (>48h since delivery)
    const deliveredNoPod = loads.filter((l) =>
      (l.status === "Delivered" || l.status === "POD Pending") &&
      l.deliveryDate &&
      l.deliveryDate < now - 2 * DAY
    );
    if (deliveredNoPod.length > 0 && !(await wasRecentlyNotified("📋 Missing POD"))) {
      const nums = deliveredNoPod.slice(0, 3).map((l) => l.loadNumber).join(", ");
      const suffix = deliveredNoPod.length > 3 ? ` and ${deliveredNoPod.length - 3} more` : "";
      await ctx.db.insert("notifications", {
        orgId: s.orgId as never,
        userId: s.userId as never,
        title: `📋 ${deliveredNoPod.length} load${deliveredNoPod.length > 1 ? "s" : ""} missing POD`,
        body: `${nums}${suffix} — delivered over 48 hours ago without proof of delivery.`,
        link: "/loads",
        type: "document",
      });
      notificationsSent++;
    }
    scanned.push("missing_pod");

    return { scanned, notificationsSent, timestamp: now };
  },
});
