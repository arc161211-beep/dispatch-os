import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ---------------------------------------------------------------------------
// PHASE 13: Automated Proactive Operations Scan
//
// Runs once daily at 06:00 UTC (off-peak hour) to scan all organizations
// for operational issues and send notifications to write-role users.
//
// Checks performed:
// - Overdue invoices
// - Expiring driver documents (license, medical card)
// - Stale GPS (tracking-active trucks with no update >1h)
// - Pending driver offers (>24h without response)
// - Delivered loads missing POD (>48h)
//
// Idempotent: uses 24-hour deduplication on notification titles.
// Bounded: scans max 100 orgs, 200-500 records per entity type.
// Safe to run repeatedly.
// ---------------------------------------------------------------------------

crons.daily(
  "proactive operations scan",
  { hourUTC: 6, minuteUTC: 23 }, // off-peak: 6:23 UTC daily
  internal.dashboard.scheduledProactiveScan,
);

export default crons;
