// ---------------------------------------------------------------------------
// E-Signature workflow — backend mutations and queries.
//
// SAFETY: Every function enforces org isolation via requireOrg / requireWrite.
// Signers can only sign requests assigned to them. Financial/mutation actions
// require explicit human approval. AI tools remain read-only.
// ---------------------------------------------------------------------------

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { requireOrg, requireWrite, loadScope } from "./lib/context";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get a signature request with all signers and signatures. */
export const get = query({
  args: { requestId: v.id("signatureRequests") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req || req.orgId !== s.orgId) throw new ConvexError("Signature request not found.");

    const signers = await ctx.db
      .query("signatureRequestSigners")
      .withIndex("by_request", (q) => q.eq("signatureRequestId", args.requestId))
      .collect();

    const signerDetails = await Promise.all(
      signers.map(async (sr) => {
        let signature = null;
        if (sr.signatureId) {
          signature = await ctx.db.get(sr.signatureId);
        }
        return { ...sr, signature };
      }),
    );

    const document = await ctx.db.get(req.documentId);
    const load = req.loadId ? await ctx.db.get(req.loadId) : null;

    return { request: req, signers: signerDetails, document, load };
  },
});

/** List all signature requests for the current org. */
export const listAllRequests = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const rows = await ctx.db
      .query("signatureRequests")
      .withIndex("by_org", (q) => q.eq("orgId", s.orgId))
      .order("desc")
      .take(100);
    return rows;
  },
});

/** Get signature requests I need to sign. */
export const getMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const rows = await ctx.db
      .query("signatureRequestSigners")
      .withIndex("by_user", (q) => q.eq("signerUserId", s.userId))
      .collect();

    const requests: typeof rows = [];
    for (const row of rows) {
      const req = await ctx.db.get(row.signatureRequestId);
      if (req && req.orgId === s.orgId) {
        requests.push(row);
      }
    }

    // Fetch full request details
    const enriched = await Promise.all(
      requests.map(async (sr) => {
        const req = await ctx.db.get(sr.signatureRequestId);
        const document = req ? await ctx.db.get(req.documentId) : null;
        const allSigners = await ctx.db
          .query("signatureRequestSigners")
          .withIndex("by_request", (q) => q.eq("signatureRequestId", sr.signatureRequestId))
          .collect();
        return { signer: sr, request: req, document, allSigners };
      }),
    );

    return enriched;
  },
});

/** List signature requests for a load. */
export const getByLoad = query({
  args: { loadId: v.id("loads") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const rows = await ctx.db
      .query("signatureRequests")
      .withIndex("by_org_load", (q) => q.eq("orgId", s.orgId).eq("loadId", args.loadId))
      .collect();

    const enriched = await Promise.all(
      rows.map(async (req) => {
        const signers = await ctx.db
          .query("signatureRequestSigners")
          .withIndex("by_request", (q) => q.eq("signatureRequestId", req._id))
          .collect();
        const document = await ctx.db.get(req.documentId);
        return { request: req, signers, document };
      }),
    );

    return enriched;
  },
});

/** Get signature audit trail for a request. */
export const getAuditTrail = query({
  args: { requestId: v.id("signatureRequests") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req || req.orgId !== s.orgId) throw new ConvexError("Signature request not found.");

    const signers = await ctx.db
      .query("signatureRequestSigners")
      .withIndex("by_request", (q) => q.eq("signatureRequestId", args.requestId))
      .collect();

    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_request", (q) => q.eq("signatureRequestId", args.requestId))
      .collect();

    return { request: req, signers, signatures };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a signature request for a document.
 * Requires write role. Validates document belongs to same org.
 */
export const createRequest = mutation({
  args: {
    documentId: v.id("documents"),
    loadId: v.optional(v.id("loads")),
    message: v.optional(v.string()),
    sequential: v.optional(v.boolean()),
    signers: v.array(
      v.object({
        signerUserId: v.optional(v.id("users")),
        signerName: v.string(),
        signerEmail: v.optional(v.string()),
        role: v.union(...([] as any)), // validated below
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);

    // Validate document exists and belongs to org
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.orgId !== s.orgId) throw new ConvexError("Document not found in this workspace.");

    // Validate load if provided
    if (args.loadId) {
      const load = await ctx.db.get(args.loadId);
      if (!load || load.orgId !== s.orgId) throw new ConvexError("Load not found in this workspace.");
    }

    // Check if there's already an active (non-completed/non-cancelled) request for this document
    const existing = await ctx.db
      .query("signatureRequests")
      .withIndex("by_org_document", (q) => q.eq("orgId", s.orgId).eq("documentId", args.documentId))
      .collect();
    const activeExisting = existing.find(
      (r) => r.status === "pending" || r.status === "in_progress",
    );
    if (activeExisting) {
      throw new ConvexError("An active signature request already exists for this document.");
    }

    // Validate signers
    if (args.signers.length === 0) throw new ConvexError("At least one signer is required.");
    if (args.signers.length > 10) throw new ConvexError("Maximum 10 signers allowed.");

    // Validate signer roles against actual constants
    const validRoles = ["carrier", "dispatcher", "broker", "shipper", "driver", "other"] as const;

    // Create the request
    const requestId = await ctx.db.insert("signatureRequests", {
      orgId: s.orgId as never,
      documentId: args.documentId,
      loadId: args.loadId as any,
      status: "pending",
      createdBy: s.userId,
      createdByName: s.name,
      message: args.message?.slice(0, 1000),
      sequential: args.sequential ?? false,
    });

    // Create signers
    for (const signer of args.signers) {
      if (!validRoles.includes(signer.role as any)) {
        throw new ConvexError(`Invalid signer role: ${signer.role}`);
      }
      await ctx.db.insert("signatureRequestSigners", {
        orgId: s.orgId as never,
        signatureRequestId: requestId,
        signerUserId: signer.signerUserId as any,
        signerName: signer.signerName.slice(0, 200),
        signerEmail: signer.signerEmail?.slice(0, 200),
        role: signer.role as any,
        order: signer.order,
        status: "pending",
      });
    }

    // Audit
    await audit(ctx, s, {
      action: "signature.request.created",
      entity: "signatureRequest",
      entityId: requestId,
      metadata: {
        documentId: args.documentId,
        loadId: args.loadId,
        signerCount: args.signers.length,
        sequential: args.sequential ?? false,
      },
    });

    // Notification to each signer with a linked user
    for (const signer of args.signers) {
      if (signer.signerUserId) {
        const { notify } = await import("./notifications");
        await notify(ctx, s, {
          title: "Signature Required",
          body: `${s.name ?? "Someone"} requested your signature on a document.`,
          link: `/sign/${requestId}`,
          type: "document",
        });
      }
    }

    return { requestId };
  },
});

/** Signer marks document as viewed. */
export const markViewed = mutation({
  args: { signerRowId: v.id("signatureRequestSigners") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const row = await ctx.db.get(args.signerRowId);
    if (!row || row.orgId !== s.orgId) throw new ConvexError("Signer not found.");
    if (row.signerUserId !== s.userId) throw new ConvexError("You can only update your own signing status.");
    if (row.status !== "pending") return { ok: true }; // already past pending
    await ctx.db.patch(args.signerRowId, { status: "viewed", viewedAt: Date.now() });

    // Update parent request to in_progress if still pending
    const req = await ctx.db.get(row.signatureRequestId);
    if (req && req.status === "pending") {
      await ctx.db.patch(row.signatureRequestId, { status: "in_progress" });
    }

    return { ok: true };
  },
});

/**
 * Sign a document. Supports draw, upload, and typed signatures.
 * - draw: signatureStorageId (Convex storage ID of drawn image)
 * - upload: signatureStorageId (Convex storage ID of uploaded image)
 * - typed: signatureText (the typed name rendered as signature)
 */
export const signDocument = mutation({
  args: {
    signerRowId: v.id("signatureRequestSigners"),
    signatureType: v.union(v.literal("draw"), v.literal("upload"), v.literal("typed")),
    signatureStorageId: v.optional(v.string()),
    signatureText: v.optional(v.string()),
    consentConfirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);

    if (!args.consentConfirmed) {
      throw new ConvexError("You must confirm electronic signing consent.");
    }

    const row = await ctx.db.get(args.signerRowId);
    if (!row || row.orgId !== s.orgId) throw new ConvexError("Signer not found.");
    if (row.signerUserId !== s.userId) throw new ConvexError("You can only sign your own request.");
    if (row.status === "signed") throw new ConvexError("You have already signed this document.");

    const req = await ctx.db.get(row.signatureRequestId);
    if (!req) throw new ConvexError("Signature request not found.");
    if (req.status === "completed" || req.status === "cancelled" || req.status === "declined") {
      throw new ConvexError(`This signature request is ${req.status} and can no longer be signed.`);
    }
    if (req.expiresAt && req.expiresAt < Date.now()) {
      throw new ConvexError("This signature request has expired.");
    }

    // Validate sequential ordering: if sequential, earlier signers must have signed
    if (req.sequential) {
      const allSigners = await ctx.db
        .query("signatureRequestSigners")
        .withIndex("by_request", (q) => q.eq("signatureRequestId", req._id))
        .collect();
      const earlier = allSigners.filter((sr) => sr.order < row.order);
      const allEarlierSigned = earlier.every((sr) => sr.status === "signed" || sr.signerUserId === s.userId);
      if (!allEarlierSigned) {
        throw new ConvexError("Previous signers must sign first (sequential signing).");
      }
    }

    // Validate signature data
    if (args.signatureType === "draw" || args.signatureType === "upload") {
      if (!args.signatureStorageId) throw new ConvexError("Signature image is required for draw/upload.");
    }
    if (args.signatureType === "typed") {
      if (!args.signatureText || args.signatureText.trim().length === 0) {
        throw new ConvexError("Signature text is required for typed signatures.");
      }
    }

    // Create signature record
    const sigId = await ctx.db.insert("signatures", {
      orgId: s.orgId as never,
      signatureRequestId: row.signatureRequestId,
      signerId: args.signerRowId,
      signerUserId: s.userId,
      signerName: s.name ?? row.signerName,
      signatureType: args.signatureType,
      signatureStorageId: args.signatureStorageId,
      signatureText: args.signatureText?.slice(0, 200),
      signedAt: Date.now(),
      consentConfirmed: true,
    });

    // Update signer row
    await ctx.db.patch(args.signerRowId, {
      status: "signed",
      signedAt: Date.now(),
      signatureId: sigId,
    });

    // Audit
    await audit(ctx, s, {
      action: "signature.signed",
      entity: "signatureRequest",
      entityId: row.signatureRequestId,
      metadata: {
        signerName: row.signerName,
        signatureType: args.signatureType,
        signerRowId: args.signerRowId,
      },
    });

    // Check if all signers have now signed
    const allSigners = await ctx.db
      .query("signatureRequestSigners")
      .withIndex("by_request", (q) => q.eq("signatureRequestId", req._id))
      .collect();
    const allSigned = allSigners.every((sr) => sr.status === "signed");

    if (allSigned) {
      await ctx.db.patch(req._id, {
        status: "completed",
        completedAt: Date.now(),
      });
      await audit(ctx, s, {
        action: "signature.request.completed",
        entity: "signatureRequest",
        entityId: req._id,
        metadata: { totalSigners: allSigners.length },
      });
      // Notify the creator
      if (req.createdBy !== s.userId) {
        const { notify } = await import("./notifications");
        await notify(ctx, s, {
          title: "Signature Request Completed",
          body: `All ${allSigners.length} signer(s) have signed the document.`,
          link: `/sign/${req._id}`,
          type: "document",
        });
      }
    } else if (req.sequential) {
      // Phase 11: Notify the NEXT signer in a sequential request
      const sortedSigners = allSigners
        .filter((sr) => sr.status === "pending" || sr.status === "viewed")
        .sort((a, b) => a.order - b.order);
      const nextSigner = sortedSigners[0];
      if (nextSigner && nextSigner.signerUserId) {
        const { notify } = await import("./notifications");
        await notify(ctx, s, {
          title: "Your Signature Is Required",
          body: `A document is ready for your signature. Previous signer (${row.signerName}) has signed.`,
          link: `/sign/${req._id}`,
          type: "document",
        });
      }
    }

    return { ok: true, completed: allSigned, signatureId: sigId };
  },
});

/** Signer declines to sign. */
export const declineSignature = mutation({
  args: {
    signerRowId: v.id("signatureRequestSigners"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const row = await ctx.db.get(args.signerRowId);
    if (!row || row.orgId !== s.orgId) throw new ConvexError("Signer not found.");
    if (row.signerUserId !== s.userId) throw new ConvexError("You can only update your own signing status.");
    if (row.status === "signed" || row.status === "declined") {
      throw new ConvexError(`Already ${row.status}.`);
    }

    await ctx.db.patch(args.signerRowId, {
      status: "declined",
      declinedAt: Date.now(),
      declineReason: args.reason?.slice(0, 500),
    });

    // Update parent request to declined
    const req = await ctx.db.get(row.signatureRequestId);
    if (req) {
      await ctx.db.patch(row.signatureRequestId, { status: "declined" });
    }

    await audit(ctx, s, {
      action: "signature.declined",
      entity: "signatureRequest",
      entityId: row.signatureRequestId,
      metadata: { signerName: row.signerName, reason: args.reason?.slice(0, 200) },
    });

    // Notify creator
    if (req && req.createdBy !== s.userId) {
      const { notify } = await import("./notifications");
      await notify(ctx, s, {
        title: "Signature Declined",
        body: `${row.signerName} declined to sign.${args.reason ? ` Reason: ${args.reason.slice(0, 100)}` : ""}`,
        link: `/sign/${row.signatureRequestId}`,
        type: "document",
      });
    }

    return { ok: true };
  },
});

/** Creator cancels a signature request. */
export const cancelRequest = mutation({
  args: { requestId: v.id("signatureRequests") },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req || req.orgId !== s.orgId) throw new ConvexError("Signature request not found.");
    if (req.createdBy !== s.userId && s.role !== "admin" && s.role !== "super_admin") {
      throw new ConvexError("Only the creator or an admin can cancel a signature request.");
    }
    if (req.status === "completed" || req.status === "cancelled") {
      throw new ConvexError(`Request is already ${req.status}.`);
    }

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    await audit(ctx, s, {
      action: "signature.request.cancelled",
      entity: "signatureRequest",
      entityId: args.requestId,
    });

    return { ok: true };
  },
});
