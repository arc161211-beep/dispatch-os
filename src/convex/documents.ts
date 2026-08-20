import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DOCUMENT_TYPES, LOAD_DOC_CHECKLIST } from "./constants";
import { audit } from "./lib/audit";
import { isAdminRole, loadScope, requireOrg, requireWrite } from "./lib/context";
import { optString, validateFileMeta } from "./lib/validation";

const EXPIRY_WARNING_DAYS = 30;

/** Determine expiry status from expiresAt timestamp. */
function expiryStatus(expiresAt?: number | null): "active" | "expiring" | "expired" | undefined {
  if (!expiresAt) return undefined;
  const now = Date.now();
  if (expiresAt < now) return "expired";
  if (expiresAt < now + EXPIRY_WARNING_DAYS * 86_400_000) return "expiring";
  return "active";
}

export const list = query({
  args: { entityType: v.optional(v.string()), entityId: v.optional(v.string()), type: v.optional(v.string()), status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    let docs = await ctx.db.query("documents").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.entityType) docs = docs.filter((d) => d.entityType === args.entityType);
    if (args.entityId) docs = docs.filter((d) => d.entityId === args.entityId);
    if (args.type) docs = docs.filter((d) => d.type === args.type);
    if (args.status) docs = docs.filter((d) => (d.status ?? expiryStatus(d.expiresAt)) === args.status);
    docs.sort((a, b) => b._creationTime - a._creationTime);
    return docs.slice(0, args.limit ?? 300).map((d) => ({
      ...d,
      computedStatus: d.status ?? expiryStatus(d.expiresAt),
    }));
  },
});

/** Get documents expiring soon across the organization. */
export const expiringSoon = query({
  args: { withinDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const days = args.withinDays ?? 30;
    const cutoff = Date.now() + days * 86_400_000;
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_org_expires", (q) => q.eq("orgId", s.orgId).lte("expiresAt", cutoff))
      .collect();
    return docs
      .filter((d) => d.expiresAt && d.expiresAt > Date.now()) // not yet expired
      .map((d) => ({
        ...d,
        computedStatus: expiryStatus(d.expiresAt),
        daysUntilExpiry: d.expiresAt ? Math.ceil((d.expiresAt - Date.now()) / 86_400_000) : null,
      }));
  },
});

export const getUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const url = await ctx.storage.getUrl(args.storageId as never);
    return url ?? null;
  },
});

/**
 * Short-lived, unguessable upload URL.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Register a completed upload. Supports versioning: when replacing a document,
 * pass previousVersionId to supersede the old version.
 */
export const upload = mutation({
  args: {
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    type: v.union(...DOCUMENT_TYPES.map((t) => v.literal(t))),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    storageId: v.string(),
    notes: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    previousVersionId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const meta = validateFileMeta(args);
    if (args.entityType && args.entityId) {
      const entity = await ctx.db.get(args.entityId as never);
      if (!entity || (entity as { orgId?: string }).orgId !== s.orgId) {
        throw new ConvexError("Linked record not found in this workspace.");
      }
    }

    // Determine version number
    let version = 1;
    if (args.previousVersionId) {
      const prev = await ctx.db.get(args.previousVersionId);
      if (prev && prev.orgId === s.orgId) {
        version = ((prev as any).version ?? 0) + 1;
        // Supersede the previous version
        await ctx.db.patch(args.previousVersionId, { status: "superseded" } as any);
      }
    }

    const computedStatus = expiryStatus(args.expiresAt);

    const id = await ctx.db.insert("documents", {
      orgId: s.orgId as never,
      entityType: args.entityType,
      entityId: args.entityId,
      type: args.type,
      fileName: meta.fileName,
      storageId: args.storageId,
      mimeType: meta.mimeType,
      size: meta.size,
      uploadedBy: s.userId as never,
      uploadedByName: s.name,
      notes: optString(args.notes, 1000),
      version,
      previousVersionId: args.previousVersionId as any,
      expiresAt: args.expiresAt,
      status: computedStatus,
    });
    await audit(ctx, s, {
      action: "document.uploaded",
      entity: "document",
      entityId: id,
      metadata: { type: args.type, entityType: args.entityType, entityId: args.entityId, fileName: meta.fileName, version, expiresAt: args.expiresAt },
    });
    return { id, version };
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== s.orgId) throw new ConvexError("Document not found.");
    if (!isAdminRole(s.role) && doc.uploadedBy !== s.userId) {
      throw new ConvexError("Only the uploader or an administrator can delete documents.");
    }
    if (doc.storageId) await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.id);
    await audit(ctx, s, {
      action: "document.deleted",
      entity: "document",
      entityId: args.id,
      metadata: { type: doc.type, fileName: doc.fileName },
    });
    return { ok: true };
  },
});

/** Standard per-load document checklist (Rate Confirmation, BOL, POD). */
const EXPIRY_NOTIFICATION_DAYS = 30;

/**
 * Create notifications for documents expiring soon. Safe to call repeatedly —
 * only creates a notification if no existing unread notification references
 * the same document within the expiry window.
 * Can be triggered by admin action or a scheduled cron.
 */
export const notifyExpiringSoon = mutation({
  args: { withinDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const days = args.withinDays ?? EXPIRY_NOTIFICATION_DAYS;
    const cutoff = Date.now() + days * 86_400_000;

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_org_expires", (q) => q.eq("orgId", s.orgId).lte("expiresAt", cutoff))
      .collect();

    const expiring = docs.filter((d) => d.expiresAt && d.expiresAt > Date.now() && d.status !== "superseded");
    let created = 0;

    for (const doc of expiring) {
      const daysLeft = Math.ceil(((doc.expiresAt ?? 0) - Date.now()) / 86_400_000);
      const title = `Document expiring: ${doc.fileName}`;
      const body = `"${doc.type}" expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${new Date(doc.expiresAt!).toLocaleDateString()}).`;

      // Dedup: check if there's already an unread notification for this doc
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_org_user", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId))
        .take(50);

      const alreadyNotified = existing.some(
        (n) => n.type === "document" && n.body?.includes(doc.fileName) && !n.readAt,
      );

      if (!alreadyNotified) {
        await ctx.db.insert("notifications", {
          orgId: s.orgId as never,
          userId: s.userId as never,
          title,
          body,
          type: "document",
        });
        created++;
      }
    }

    return { created, checked: expiring.length };
  },
});

export const checklist = query({
  args: { loadId: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const load = await ctx.db.get(args.loadId);
    if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found.");
    if (scope.driverId && load.driverId !== scope.driverId) throw new ConvexError("Load not found.");
    const docs = await ctx.db.query("documents").withIndex("by_org_entity", (q) =>
      q.eq("orgId", s.orgId).eq("entityType", "load").eq("entityId", args.loadId),
    ).collect();
    return LOAD_DOC_CHECKLIST.map((type) => ({
      type,
      received: docs.filter((d) => d.type === type).length,
      docs: docs.filter((d) => d.type === type),
      status: docs.some((d) => d.type === type) ? ("received" as const) : ("missing" as const),
    }));
  },
});
