// ---------------------------------------------------------------------------
// CSV Export for DispatchOS.
//
// Generates CSV data for the key entities. All exports are:
//   - Organization-scoped (never export data from other orgs)
//   - Role-filtered (carrier_admin only sees their carrier's data)
//   - Financial-visibility-aware (respects carrierFinancialVisibility setting)
//   - Bounded (max 2000 rows per export)
//   - Audited (every export is logged in audit trail)
//
// Returns CSV string (header + rows). Frontend is responsible for creating
// the download blob.
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { getFinancialVisibility, requiresFinancialFiltering, type CarrierFinancialVisibility } from "./lib/visibility";

const EXPORT_LIMIT = 2000;

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const carriers = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    let rows = await ctx.db.query("carriers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    // carrier_admin: only their carrier
    if (s.role === "carrier_admin" && s.carrierId) {
      rows = rows.filter((c) => c._id === s.carrierId);
    }
    const data = toCsv(
      ["Company", "Contact", "Email", "Phone", "MC", "USDOT", "Status", "Fee Type", "Fee Rate %"],
      rows.map((c) => [c.companyName, c.contactName, c.email, c.phone, c.mcNumber, c.usdot, c.status, c.feeType, c.feeRatePercent]),
    );
    await auditExport(ctx, s, "carriers", rows.length);
    return { csv: data, count: rows.length };
  },
});

export const trucks = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    let rows = await ctx.db.query("trucks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    if (s.role === "carrier_admin" && s.carrierId) {
      rows = rows.filter((t) => t.carrierId === s.carrierId);
    }
    const data = toCsv(
      ["Unit #", "Type", "Make", "Model", "Year", "VIN", "Plate", "Location", "Availability", "Carrier ID"],
      rows.map((t) => [t.unitNumber, t.type, t.make, t.model, t.year, t.vin, t.plate, t.currentLocation, t.availability, t.carrierId]),
    );
    await auditExport(ctx, s, "trucks", rows.length);
    return { csv: data, count: rows.length };
  },
});

export const drivers = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    let rows = await ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    if (s.role === "carrier_admin" && s.carrierId) {
      rows = rows.filter((d) => d.carrierId === s.carrierId);
    }
    const data = toCsv(
      ["Name", "Phone", "Email", "Home Location", "Availability", "License Expiry", "Medical Card Expiry", "Carrier ID"],
      rows.map((d) => [d.name, d.phone, d.email, d.homeLocation, d.availability, d.licenseExpiry ? new Date(d.licenseExpiry).toISOString().slice(0, 10) : "", d.medicalCardExpiry ? new Date(d.medicalCardExpiry).toISOString().slice(0, 10) : "", d.carrierId]),
    );
    await auditExport(ctx, s, "drivers", rows.length);
    return { csv: data, count: rows.length };
  },
});

export const brokers = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    const rows = await ctx.db.query("brokers").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    const data = toCsv(
      ["Company", "MC", "Contact", "Phone", "Email", "Status", "Risk Flag"],
      rows.map((b) => [b.company, b.mc, b.contactName, b.phone, b.email, b.status, b.riskFlag]),
    );
    await auditExport(ctx, s, "brokers", rows.length);
    return { csv: data, count: rows.length };
  },
});

export const leads = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    const rows = await ctx.db.query("leads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    const data = toCsv(
      ["Company", "Contact", "Email", "Phone", "City", "State", "MC", "Status", "Source", "Next Follow-Up"],
      rows.map((l) => [l.companyName, l.contactName, l.email, l.phone, l.city, l.state, l.mc, l.status, l.source, l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString().slice(0, 10) : ""]),
    );
    await auditExport(ctx, s, "leads", rows.length);
    return { csv: data, count: rows.length };
  },
});

export const loads = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    let rows = await ctx.db.query("loads").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    if (s.role === "carrier_admin" && s.carrierId) {
      rows = rows.filter((l) => l.carrierId === s.carrierId);
    }
    if (s.role === "driver" && s.driverId) {
      rows = rows.filter((l) => l.driverId === s.driverId);
    }

    // Financial visibility enforcement
    let vis: CarrierFinancialVisibility = "full";
    if (requiresFinancialFiltering(s.role)) {
      vis = await getFinancialVisibility(ctx, s.orgId);
    }

    const headers = ["Load #", "Status", "Origin", "Destination", "Pickup", "Delivery", "Equipment", "Gross Rate"];
    if (vis === "full" || vis === "fee_visible") headers.push("Dispatcher Fee", "Fee %");
    if (vis === "full") headers.push("Carrier Amount", "RPM", "Eff. RPM");

    const data = toCsv(
      headers,
      rows.map((l) => {
        const row: (string | number | null | undefined)[] = [
          l.loadNumber,
          l.status,
          l.origin,
          l.destination,
          l.pickupDate ? new Date(l.pickupDate).toISOString().slice(0, 10) : "",
          l.deliveryDate ? new Date(l.deliveryDate).toISOString().slice(0, 10) : "",
          l.equipment,
          l.grossRateCents !== undefined && l.grossRateCents !== null ? `$${(l.grossRateCents / 100).toFixed(2)}` : "",
        ];
        if (vis === "full" || vis === "fee_visible") {
          row.push(l.feeCents !== undefined && l.feeCents !== null ? `$${(l.feeCents / 100).toFixed(2)}` : "", l.feeRatePercent ?? "");
        }
        if (vis === "full") {
          row.push(l.carrierAmountCents !== undefined && l.carrierAmountCents !== null ? `$${(l.carrierAmountCents / 100).toFixed(2)}` : "", l.rpm ?? "", l.effectiveRpm ?? "");
        }
        return row;
      }),
    );
    await auditExport(ctx, s, "loads", rows.length);
    return { csv: data, count: rows.length };
  },
});

export const invoices = mutation({
  args: {},
  handler: async (ctx) => {
    const s = await requireWrite(ctx);
    let rows = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(EXPORT_LIMIT);
    if (s.role === "carrier_admin" && s.carrierId) {
      rows = rows.filter((i) => i.carrierId === s.carrierId);
    }

    // Financial visibility enforcement
    let vis: CarrierFinancialVisibility = "full";
    if (requiresFinancialFiltering(s.role)) {
      vis = await getFinancialVisibility(ctx, s.orgId);
    }

    const headers = ["Invoice #", "Status", "Issue Date", "Due Date"];
    if (vis !== "none") headers.push("Amount");
    if (vis === "full") headers.push("Paid", "Outstanding");
    headers.push("Notes");

    const data = toCsv(
      headers,
      rows.map((i) => {
        const row: (string | number | null | undefined)[] = [
          i.invoiceNumber,
          i.status,
          i.issueDate ? new Date(i.issueDate).toISOString().slice(0, 10) : "",
          i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : "",
        ];
        if (vis !== "none") row.push(i.amountCents !== null ? `$${(i.amountCents / 100).toFixed(2)}` : "");
        if (vis === "full") row.push(`$${(i.paidCents / 100).toFixed(2)}`, `$${((i.amountCents - i.paidCents) / 100).toFixed(2)}`);
        row.push(i.notes ?? "");
        return row;
      }),
    );
    await auditExport(ctx, s, "invoices", rows.length);
    return { csv: data, count: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------

async function auditExport(ctx: any, s: any, entityType: string, count: number) {
  const { audit } = await import("./lib/audit");
  await audit(ctx, s, {
    action: "export.completed",
    entity: entityType,
    metadata: { entityType, count, exportedBy: s.userId },
  });
}
