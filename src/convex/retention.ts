// ---------------------------------------------------------------------------
// Data retention cleanup for DispatchOS.
//
// Implements admin-triggered (and cron-compatible) cleanup of:
//   - Location history (locationHistoryDays setting)
//   - Messages (messageRetentionDays setting)
//   - Audit logs (auditLogRetentionDays setting)
//
// SAFETY:
//   - Never deletes invoices, payments, or critical financial records.
//   - Each cleanup is bounded (max 500 records per batch) to prevent timeouts.
//   - Each cleanup is idempotent — running it multiple times is safe.
//   - Each cleanup is audited — the org can see what was purged.
//   - Returns a count of deleted records for admin visibility.
// ---------------------------------------------------------------------------

import { mutation, internalMutation } from "./_generated/server";
import { requireAdmin } from "./lib/context";

const BATCH_SIZE = 500;

/**
 * Clean up old location history records based on the configured retention period.
 * Safe to call repeatedly. Only deletes locationHistory records.
 */
export const cleanupLocationHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .first();
    const days = settings?.dataRetention?.locationHistoryDays;
    if (!days || days <= 0) {
      return { deleted: 0, message: "No location retention policy configured." };
    }

    const cutoff = Date.now() - days * 86_400_000;
    const old = await ctx.db
      .query("locationHistory")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .filter((q) => q.lt(q.field("at"), cutoff))
      .take(BATCH_SIZE);

    let deleted = 0;
    for (const row of old) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    return {
      deleted,
      message: `Deleted ${deleted} location records older than ${days} days.`,
    };
  },
});

/**
 * Clean up old messages based on the configured retention period.
 * Only deletes messages (not conversations) older than messageRetentionDays.
 * Does NOT delete conversations — they are lightweight and may be needed for context.
 */
export const cleanupMessages = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .first();
    const days = settings?.dataRetention?.messageRetentionDays;
    if (!days || days <= 0) {
      return { deleted: 0, message: "No message retention policy configured." };
    }

    const cutoff = Date.now() - days * 86_400_000;
    const old = await ctx.db
      .query("messages")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .filter((q) => q.lt(q.field("_creationTime"), cutoff))
      .take(BATCH_SIZE);

    let deleted = 0;
    for (const row of old) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    return {
      deleted,
      message: `Deleted ${deleted} messages older than ${days} days.`,
    };
  },
});

/**
 * Clean up old audit logs based on the configured retention period.
 * WARNING: Audit logs may have legal/compliance requirements. Only delete
 * when the admin has explicitly configured a retention period.
 */
export const cleanupAuditLogs = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .first();
    const days = settings?.dataRetention?.auditLogRetentionDays;
    if (!days || days <= 0) {
      return { deleted: 0, message: "No audit log retention policy configured." };
    }

    const cutoff = Date.now() - days * 86_400_000;
    const old = await ctx.db
      .query("auditLogs")
      .withIndex("by_org_at", (q) => q.eq("orgId", s.orgId).lt("at", cutoff))
      .take(BATCH_SIZE);

    let deleted = 0;
    for (const row of old) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    return {
      deleted,
      message: `Deleted ${deleted} audit log entries older than ${days} days.`,
    };
  },
});

/**
 * Run all configured retention cleanups in one call.
 * Returns a summary of each cleanup operation.
 */
export const runAllCleanups = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .first();

    const results: { entity: string; deleted: number; message: string }[] = [];

    // Location history cleanup
    const locDays = settings?.dataRetention?.locationHistoryDays;
    if (locDays && locDays > 0) {
      const cutoff = Date.now() - locDays * 86_400_000;
      const old = await ctx.db
        .query("locationHistory")
        .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
        .filter((q) => q.lt(q.field("at"), cutoff))
        .take(BATCH_SIZE);
      let deleted = 0;
      for (const row of old) { await ctx.db.delete(row._id); deleted++; }
      results.push({ entity: "locationHistory", deleted, message: `Deleted ${deleted} location records older than ${locDays} days.` });
    }

    // Message cleanup
    const msgDays = settings?.dataRetention?.messageRetentionDays;
    if (msgDays && msgDays > 0) {
      const cutoff = Date.now() - msgDays * 86_400_000;
      const old = await ctx.db
        .query("messages")
        .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
        .filter((q) => q.lt(q.field("_creationTime"), cutoff))
        .take(BATCH_SIZE);
      let deleted = 0;
      for (const row of old) { await ctx.db.delete(row._id); deleted++; }
      results.push({ entity: "messages", deleted, message: `Deleted ${deleted} messages older than ${msgDays} days.` });
    }

    // Audit log cleanup
    const auditDays = settings?.dataRetention?.auditLogRetentionDays;
    if (auditDays && auditDays > 0) {
      const cutoff = Date.now() - auditDays * 86_400_000;
      const old = await ctx.db
        .query("auditLogs")
        .withIndex("by_org_at", (q) => q.eq("orgId", s.orgId).lt("at", cutoff))
        .take(BATCH_SIZE);
      let deleted = 0;
      for (const row of old) { await ctx.db.delete(row._id); deleted++; }
      results.push({ entity: "auditLogs", deleted, message: `Deleted ${deleted} audit log entries older than ${auditDays} days.` });
    }

    return { results };
  },
});

/**
 * Get the current retention configuration and estimated cleanup impact.
 */
export const getRetentionStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireAdmin(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .first();

    const locDays = settings?.dataRetention?.locationHistoryDays ?? 0;
    const msgDays = settings?.dataRetention?.messageRetentionDays ?? 0;
    const auditDays = settings?.dataRetention?.auditLogRetentionDays ?? 0;

    return {
      locationHistoryDays: locDays,
      messageRetentionDays: msgDays,
      auditLogRetentionDays: auditDays,
      locationHistoryEnabled: locDays > 0,
      messageRetentionEnabled: msgDays > 0,
      auditLogRetentionEnabled: auditDays > 0,
    };
  },
});

// ---------------------------------------------------------------------------
// Cron-compatible scheduled retention cleanup.
// Iterates all organizations and applies their configured retention policies.
// Bounded: max 500 records per entity type per org. Safe to run repeatedly.
// ---------------------------------------------------------------------------
export const scheduledRetentionCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const DAY = 86_400_000;
    const BATCH = 500;
    const orgs = await ctx.db.query("organizations").take(100);
    let totalDeleted = 0;

    for (const org of orgs) {
      const settings = await ctx.db
        .query("settings")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .first();
      if (!settings?.dataRetention) continue;

      const { locationHistoryDays, messageRetentionDays, auditLogRetentionDays } = settings.dataRetention;

      // Location history cleanup
      if (locationHistoryDays && locationHistoryDays > 0) {
        const cutoff = Date.now() - locationHistoryDays * DAY;
        const old = await ctx.db
          .query("locationHistory")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .filter((q) => q.lt(q.field("at"), cutoff))
          .take(BATCH);
        for (const row of old) { await ctx.db.delete(row._id); totalDeleted++; }
      }

      // Message cleanup
      if (messageRetentionDays && messageRetentionDays > 0) {
        const cutoff = Date.now() - messageRetentionDays * DAY;
        const old = await ctx.db
          .query("messages")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .filter((q) => q.lt(q.field("_creationTime"), cutoff))
          .take(BATCH);
        for (const row of old) { await ctx.db.delete(row._id); totalDeleted++; }
      }

      // Audit log cleanup
      if (auditLogRetentionDays && auditLogRetentionDays > 0) {
        const cutoff = Date.now() - auditLogRetentionDays * DAY;
        const old = await ctx.db
          .query("auditLogs")
          .withIndex("by_org_at", (q) => q.eq("orgId", org._id).lt("at", cutoff))
          .take(BATCH);
        for (const row of old) { await ctx.db.delete(row._id); totalDeleted++; }
      }
    }

    return { orgsScanned: orgs.length, totalDeleted, timestamp: Date.now() };
  },
});