/**
 * Tests for carrier financial visibility enforcement.
 *
 * These tests verify that the financial visibility filter correctly
 * strips financial data according to each mode:
 *   - "full": all financial fields visible
 *   - "rate_only": gross rate visible, fee fields hidden
 *   - "fee_visible": gross rate and fee visible, carrier amount hidden
 *   - "none": no financial fields visible
 */

import { describe, it, expect } from "vitest";
import {
  filterLoadFinancials,
  filterInvoiceFinancials,
  filterReportFinancials,
  requiresFinancialFiltering,
  type CarrierFinancialVisibility,
} from "./lib/visibility";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

function sampleLoad(overrides: Record<string, unknown> = {}) {
  return {
    _id: "load_1",
    orgId: "org_1",
    loadNumber: "LD-1001",
    status: "Booked",
    origin: "Chicago, IL",
    destination: "Dallas, TX",
    grossRateCents: 250000,
    fuelSurchargeCents: 15000,
    accessorialsCents: 5000,
    feeType: "percentage",
    feeRatePercent: 7,
    feeMinCents: null,
    feeMaxCents: null,
    flatFeeCents: null,
    feeCents: 17500,
    carrierAmountCents: 232500,
    rpm: 2.5,
    effectiveRpm: 2.17,
    truckId: "truck_1",
    driverId: "driver_1",
    ...overrides,
  };
}

function sampleInvoice(overrides: Record<string, unknown> = {}) {
  return {
    _id: "inv_1",
    orgId: "org_1",
    invoiceNumber: "INV-1001",
    status: "Sent",
    amountCents: 17500,
    paidCents: 0,
    outstandingCents: 17500,
    carrierId: "carrier_1",
    ...overrides,
  };
}

function sampleReport() {
  return {
    loadsCreated: 10,
    completedLoads: 5,
    grossLoadRevenueCents: 2500000,
    dispatcherRevenueCents: 175000,
    invoicedCents: 175000,
    paidCents: 100000,
    unpaidCents: 75000,
    overdueCents: 25000,
    invoiceCount: 5,
    overdueCount: 1,
  };
}

// ---------------------------------------------------------------------------
// Role filtering
// ---------------------------------------------------------------------------

describe("Financial visibility: role filtering", () => {
  it("carrier_admin requires financial filtering", () => {
    expect(requiresFinancialFiltering("carrier_admin")).toBe(true);
  });

  it("driver requires financial filtering", () => {
    expect(requiresFinancialFiltering("driver")).toBe(true);
  });

  it("admin does NOT require financial filtering", () => {
    expect(requiresFinancialFiltering("admin")).toBe(false);
  });

  it("dispatcher does NOT require financial filtering", () => {
    expect(requiresFinancialFiltering("dispatcher")).toBe(false);
  });

  it("operations does NOT require financial filtering", () => {
    expect(requiresFinancialFiltering("operations")).toBe(false);
  });

  it("read_only does NOT require financial filtering", () => {
    expect(requiresFinancialFiltering("read_only")).toBe(false);
  });

  it("super_admin does NOT require financial filtering", () => {
    expect(requiresFinancialFiltering("super_admin")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Load filtering
// ---------------------------------------------------------------------------

describe("Financial visibility: load filtering", () => {
  it("full mode preserves all fields", () => {
    const load = sampleLoad();
    const filtered = filterLoadFinancials(load, "full");
    expect(filtered.grossRateCents).toBe(250000);
    expect(filtered.feeCents).toBe(17500);
    expect(filtered.carrierAmountCents).toBe(232500);
    expect(filtered.rpm).toBe(2.5);
    expect(filtered.effectiveRpm).toBe(2.17);
    expect(filtered.feeRatePercent).toBe(7);
  });

  it("rate_only mode keeps gross rate but hides fee fields", () => {
    const load = sampleLoad();
    const filtered = filterLoadFinancials(load, "rate_only");
    expect(filtered.grossRateCents).toBe(250000);
    expect(filtered.feeCents).toBeUndefined();
    expect(filtered.carrierAmountCents).toBeUndefined();
    expect(filtered.feeRatePercent).toBeUndefined();
    expect(filtered.feeType).toBeUndefined();
    expect(filtered.feeMinCents).toBeUndefined();
    expect(filtered.feeMaxCents).toBeUndefined();
    expect(filtered.flatFeeCents).toBeUndefined();
    // Non-financial fields preserved
    expect(filtered.loadNumber).toBe("LD-1001");
    expect(filtered.status).toBe("Booked");
    expect(filtered.origin).toBe("Chicago, IL");
  });

  it("fee_visible mode keeps gross rate and fee but hides carrier amount", () => {
    const load = sampleLoad();
    const filtered = filterLoadFinancials(load, "fee_visible");
    expect(filtered.grossRateCents).toBe(250000);
    expect(filtered.feeCents).toBe(17500);
    expect(filtered.feeRatePercent).toBe(7);
    expect(filtered.rpm).toBe(2.5);
    expect(filtered.carrierAmountCents).toBeUndefined();
  });

  it("none mode removes ALL financial fields", () => {
    const load = sampleLoad();
    const filtered = filterLoadFinancials(load, "none");
    expect(filtered.grossRateCents).toBeUndefined();
    expect(filtered.feeCents).toBeUndefined();
    expect(filtered.carrierAmountCents).toBeUndefined();
    expect(filtered.feeRatePercent).toBeUndefined();
    expect(filtered.feeType).toBeUndefined();
    expect(filtered.rpm).toBeUndefined();
    expect(filtered.effectiveRpm).toBeUndefined();
    expect(filtered.fuelSurchargeCents).toBeUndefined();
    expect(filtered.accessorialsCents).toBeUndefined();
    // Non-financial fields preserved
    expect(filtered.loadNumber).toBe("LD-1001");
    expect(filtered.status).toBe("Booked");
    expect(filtered.origin).toBe("Chicago, IL");
    expect(filtered.destination).toBe("Dallas, TX");
  });

  it("does not mutate the original object", () => {
    const load = sampleLoad();
    filterLoadFinancials(load, "none");
    expect(load.grossRateCents).toBe(250000);
    expect(load.feeCents).toBe(17500);
  });
});

// ---------------------------------------------------------------------------
// Invoice filtering
// ---------------------------------------------------------------------------

describe("Financial visibility: invoice filtering", () => {
  it("full mode preserves all fields", () => {
    const inv = sampleInvoice();
    const filtered = filterInvoiceFinancials(inv, "full");
    expect(filtered.amountCents).toBe(17500);
    expect(filtered.paidCents).toBe(0);
    expect(filtered.outstandingCents).toBe(17500);
  });

  it("rate_only mode keeps amount but hides payment details", () => {
    const inv = sampleInvoice();
    const filtered = filterInvoiceFinancials(inv, "rate_only");
    expect(filtered.amountCents).toBe(17500);
    expect(filtered.paidCents).toBeUndefined();
    expect(filtered.outstandingCents).toBeUndefined();
  });

  it("fee_visible mode preserves all invoice fields", () => {
    const inv = sampleInvoice();
    const filtered = filterInvoiceFinancials(inv, "fee_visible");
    expect(filtered.amountCents).toBe(17500);
    expect(filtered.paidCents).toBe(0);
    expect(filtered.outstandingCents).toBe(17500);
  });

  it("none mode hides all amount fields", () => {
    const inv = sampleInvoice();
    const filtered = filterInvoiceFinancials(inv, "none");
    expect(filtered.amountCents).toBeUndefined();
    expect(filtered.paidCents).toBeUndefined();
    expect(filtered.outstandingCents).toBeUndefined();
    expect(filtered.invoiceNumber).toBe("INV-1001");
    expect(filtered.status).toBe("Sent");
  });
});

// ---------------------------------------------------------------------------
// Report filtering
// ---------------------------------------------------------------------------

describe("Financial visibility: report filtering", () => {
  it("full mode preserves all fields", () => {
    const report = sampleReport();
    const filtered = filterReportFinancials(report, "full");
    expect(filtered.grossLoadRevenueCents).toBe(2500000);
    expect(filtered.dispatcherRevenueCents).toBe(175000);
    expect(filtered.paidCents).toBe(100000);
  });

  it("rate_only mode hides fee-specific fields", () => {
    const report = sampleReport();
    const filtered = filterReportFinancials(report, "rate_only");
    expect(filtered.loadsCreated).toBe(10);
    expect(filtered.dispatcherRevenueCents).toBeUndefined();
    expect(filtered.invoicedCents).toBeUndefined();
    expect(filtered.paidCents).toBeUndefined();
    expect(filtered.unpaidCents).toBeUndefined();
    expect(filtered.overdueCents).toBeUndefined();
  });

  it("fee_visible mode preserves all fields", () => {
    const report = sampleReport();
    const filtered = filterReportFinancials(report, "fee_visible");
    expect(filtered.grossLoadRevenueCents).toBe(2500000);
    expect(filtered.dispatcherRevenueCents).toBe(175000);
    expect(filtered.paidCents).toBe(100000);
  });

  it("none mode hides all financial fields", () => {
    const report = sampleReport();
    const filtered = filterReportFinancials(report, "none");
    expect(filtered.grossLoadRevenueCents).toBeUndefined();
    expect(filtered.dispatcherRevenueCents).toBeUndefined();
    expect(filtered.invoicedCents).toBeUndefined();
    expect(filtered.paidCents).toBeUndefined();
    expect(filtered.unpaidCents).toBeUndefined();
    expect(filtered.overdueCents).toBeUndefined();
    expect(filtered.loadsCreated).toBe(10);
    expect(filtered.completedLoads).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Determinism & consistency
// ---------------------------------------------------------------------------

describe("Financial visibility: determinism", () => {
  it("filterLoadFinancials is deterministic", () => {
    const load = sampleLoad();
    const f1 = filterLoadFinancials(load, "rate_only");
    const f2 = filterLoadFinancials(load, "rate_only");
    expect(f1).toEqual(f2);
  });

  it("filterInvoiceFinancials is deterministic", () => {
    const inv = sampleInvoice();
    const f1 = filterInvoiceFinancials(inv, "none");
    const f2 = filterInvoiceFinancials(inv, "none");
    expect(f1).toEqual(f2);
  });

  it("all four modes produce different results for the same load", () => {
    const load = sampleLoad();
    const modes: CarrierFinancialVisibility[] = ["full", "rate_only", "fee_visible", "none"];
    const results = modes.map((m) => filterLoadFinancials(load, m));
    // full should have all fields
    expect(results[0].feeCents).toBeDefined();
    // none should have no financial fields
    expect(results[3].feeCents).toBeUndefined();
    // rate_only and fee_visible differ
    expect(results[1].feeCents).toBeUndefined();
    expect(results[2].feeCents).toBeDefined();
  });
});
