import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { INVOICE_STATUSES } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { filterInvoiceFinancials, getFinancialVisibility, requiresFinancialFiltering } from "./lib/visibility";

const ACTIVE_INVOICE_STATUSES = ["Draft", "Sent", "Viewed", "Partially Paid", "Overdue", "Disputed"];

/** Display status — Overdue is derived from the due date, never stored blindly. */
function effectiveStatus(inv: { status: string; dueDate?: number; paidCents: number; amountCents: number }): string {
  if (inv.status === "Partially Paid") return "Partially Paid";
  if (inv.status === "Paid" || inv.status === "Cancelled") return inv.status;
  if (inv.status === "Disputed") return "Disputed";
  if (ACTIVE_INVOICE_STATUSES.includes(inv.status) && inv.dueDate && inv.dueDate < Date.now()) return "Overdue";
  return inv.status;
}

export const list = query({
  args: { status: v.optional(v.string()), carrierId: v.optional(v.id("carriers")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let invoices = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (scope.carrierId) invoices = invoices.filter((i) => i.carrierId === scope.carrierId);
    if (args.carrierId) invoices = invoices.filter((i) => i.carrierId === args.carrierId);
    if (args.status) invoices = invoices.filter((i) => effectiveStatus(i) === args.status);
    invoices.sort((a, b) => b.issueDate - a.issueDate);
    const carrierIds = [...new Set(invoices.map((i) => i.carrierId).filter(Boolean))];
    const carriers = new Map<string, string>();
    for (const cid of carrierIds) {
      const c = await ctx.db.get(cid as never);
      if (c) carriers.set(cid as string, (c as { companyName: string }).companyName);
    }
    const mapped = invoices.slice(0, args.limit ?? 300).map((i) => ({
      ...i,
      effectiveStatus: effectiveStatus(i),
      carrierName: i.carrierId ? carriers.get(i.carrierId) ?? "" : "",
      outstandingCents: Math.max(0, i.amountCents - i.paidCents),
    }));
    if (requiresFinancialFiltering(s.role)) {
      const vis = await getFinancialVisibility(ctx, s.orgId);
      return mapped.map((i) => filterInvoiceFinancials(i, vis));
    }
    return mapped;
  },
});

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.orgId !== s.orgId) throw new ConvexError("Invoice not found.");
    const [payments, carrier, load] = await Promise.all([
      ctx.db.query("payments").withIndex("by_invoice", (q) => q.eq("invoiceId", args.id)).order("asc").collect(),
      invoice.carrierId ? ctx.db.get(invoice.carrierId) : null,
      invoice.loadId ? ctx.db.get(invoice.loadId) : null,
    ]);
    const result = {
      invoice: { ...invoice, effectiveStatus: effectiveStatus(invoice) },
      payments,
      carrierName: carrier ? (carrier as { companyName: string }).companyName : "",
      loadNumber: load ? (load as { loadNumber: string }).loadNumber : "",
    };
    if (requiresFinancialFiltering(s.role)) {
      const vis = await getFinancialVisibility(ctx, s.orgId);
      result.invoice = filterInvoiceFinancials(result.invoice, vis);
    }
    return result;
  },
});

/** Manual dispatcher invoice (e.g., monthly fee). Load completion auto-creates invoices. */
export const create = mutation({
  args: {
    carrierId: v.optional(v.id("carriers")),
    loadId: v.optional(v.id("loads")),
    amountCents: v.number(),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    if (!Number.isFinite(args.amountCents) || args.amountCents <= 0) throw new ConvexError("Invoice amount must be a positive number.");
    if (args.carrierId) {
      const c = await ctx.db.get(args.carrierId);
      if (!c || c.orgId !== s.orgId) throw new ConvexError("Carrier not found.");
    }
    const settings = await ctx.db.query("settings").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).first();
    const n = (settings?.lastInvoiceNumber ?? 0) + 1;
    if (settings) await ctx.db.patch(settings._id, { lastInvoiceNumber: n });
    const invoiceNumber = `INV-${1000 + n}`;
    const id = await ctx.db.insert("invoices", {
      orgId: s.orgId as never,
      invoiceNumber,
      carrierId: args.carrierId,
      loadId: args.loadId,
      status: "Draft",
      issueDate: Date.now(),
      dueDate: args.dueDate ?? Date.now() + 14 * 864e5,
      amountCents: Math.round(args.amountCents),
      paidCents: 0,
      notes: args.notes,
    });
    await audit(ctx, s, { action: "invoice.created", entity: "invoice", entityId: id, metadata: { invoiceNumber, amountCents: args.amountCents, carrierId: args.carrierId } });
    return { id, invoiceNumber };
  },
});

export const updateStatus = mutation({
  args: { id: v.id("invoices"), status: v.union(...INVOICE_STATUSES.map((st) => v.literal(st))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const inv = await ctx.db.get(args.id);
    if (!inv || inv.orgId !== s.orgId) throw new ConvexError("Invoice not found.");
    if (inv.status === "Paid" && args.status !== "Disputed") {
      throw new ConvexError("Paid invoices can only be reopened via Disputed.");
    }
    await ctx.db.patch(args.id, { status: args.status });
    await audit(ctx, s, { action: "invoice.status.changed", entity: "invoice", entityId: args.id, metadata: { from: inv.status, to: args.status } });
    return { ok: true };
  },
});

/**
 * Record a payment. Never auto-marks an invoice paid without a recorded
 * payment: status becomes Partially Paid or Paid strictly from paidCents.
 */
export const recordPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    amountCents: v.number(),
    method: v.optional(v.string()),
    reference: v.optional(v.string()),
    receivedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== s.orgId) throw new ConvexError("Invoice not found.");
    if (inv.status === "Cancelled") throw new ConvexError("Cannot record a payment on a cancelled invoice.");
    if (!Number.isFinite(args.amountCents) || args.amountCents <= 0) throw new ConvexError("Payment amount must be a positive number.");
    const outstanding = inv.amountCents - inv.paidCents;
    if (args.amountCents > outstanding) {
      throw new ConvexError(`Payment exceeds outstanding balance of $${(outstanding / 100).toFixed(2)}.`);
    }
    const paymentId = await ctx.db.insert("payments", {
      orgId: s.orgId as never,
      invoiceId: args.invoiceId,
      amountCents: Math.round(args.amountCents),
      method: args.method,
      reference: args.reference,
      receivedAt: args.receivedAt ?? Date.now(),
      recordedBy: s.userId as never,
    });
    const newPaid = inv.paidCents + Math.round(args.amountCents);
    const nextStatus = newPaid >= inv.amountCents ? "Paid" : "Partially Paid";
    await ctx.db.patch(args.invoiceId, { paidCents: newPaid, status: nextStatus });
    await audit(ctx, s, {
      action: "payment.recorded",
      entity: "invoice",
      entityId: args.invoiceId,
      metadata: { paymentId, amountCents: args.amountCents, method: args.method, reference: args.reference },
    });
    return { id: paymentId };
  },
});

export const remove = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const inv = await ctx.db.get(args.id);
    if (!inv || inv.orgId !== s.orgId) throw new ConvexError("Invoice not found.");
    if (inv.status !== "Draft") throw new ConvexError("Only draft invoices can be deleted.");
    await ctx.db.delete(args.id);
    await audit(ctx, s, { action: "invoice.deleted", entity: "invoice", entityId: args.id, metadata: { invoiceNumber: inv.invoiceNumber } });
    return { ok: true };
  },
});
