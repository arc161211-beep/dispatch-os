import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DOCUMENT_TYPES, LOAD_DOC_CHECKLIST } from "./constants";
import { audit } from "./lib/audit";
import { isAdminRole, loadScope, requireOrg, requireWrite } from "./lib/context";
import { optString, validateFileMeta } from "./lib/validation";

export const list = query({
  args: { entityType: v.optional(v.string()), entityId: v.optional(v.string()), type: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    let docs = await ctx.db.query("documents").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.entityType) docs = docs.filter((d) => d.entityType === args.entityType);
    if (args.entityId) docs = docs.filter((d) => d.entityId === args.entityId);
    if (args.type) docs = docs.filter((d) => d.type === args.type);
    docs.sort((a, b) => b._creationTime - a._creationTime);
    return docs.slice(0, args.limit ?? 300);
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
 * Short-lived, unguessable upload URL. The client POSTs the raw file body to
 * this URL and receives { storageId }, then registers the document metadata
 * through documents.upload (which validates extension/size/ownership).
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Register a completed upload. The file itself is uploaded through Convex
 * storage (authenticated, private). This mutation validates metadata and
 * records ownership. If validation fails the record is rejected and the UI
 * shows the error — an upload is never silently marked successful.
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
    });
    await audit(ctx, s, {
      action: "document.uploaded",
      entity: "document",
      entityId: id,
      metadata: { type: args.type, entityType: args.entityType, entityId: args.entityId, fileName: meta.fileName },
    });
    return { id };
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
