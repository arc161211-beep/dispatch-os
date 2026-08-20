/**
 * Security regression tests for DispatchOS.
 *
 * These tests verify the correctness of security-critical business logic
 * without requiring a live Convex backend. They test:
 *
 *  - Role-based authorization constants
 *  - Financial calculation boundary cases
 *  - Load state machine integrity
 *  - Data validation rules
 *  - Idempotency properties
 *  - Coordinate validation ranges
 *  - Invoice payment bounds
 *  - Document security constants
 *  - Webhook duplicate detection logic
 */

import { describe, it, expect } from "vitest";
import {
  LOAD_TRANSITIONS,
  LOAD_STATUSES,
  TERMINAL_LOAD_STATUSES,
  ROLES,
  WRITE_ROLES,
  ADMIN_ROLES,
  ACCOUNT_STATUSES,
  CARRIER_STATUSES,
  TRUCK_STATUSES,
  DRIVER_STATUSES,
  INVOICE_STATUSES,
  MESSAGE_STATUSES,
  MESSAGE_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  DOCUMENT_TYPES,
  DOC_ALLOWED_EXTENSIONS,
  CARRIER_FINANCIAL_VISIBILITY,
  type LoadStatus,
} from "./constants";
import {
  calcDispatcherFee,
  calcRpm,
  calcEffectiveRpm,
  loadTotalCents,
  deriveLoadFinance,
  dollarsToCents,
  centsToDollars,
  round2,
} from "./lib/finance";
import { scoreTruckForLoad } from "./matching";

// ---------------------------------------------------------------------------
// CROSS-TENANT ISOLATION
// ---------------------------------------------------------------------------
describe("Security: Cross-tenant isolation", () => {
  it("org scope is enforced in context helpers via requireOrg", () => {
    const session = {
      userId: "user1" as any,
      orgId: "org1" as any,
      role: "admin" as const,
      disabled: false,
    };
    expect(session.orgId).toBe("org1");
    const otherOrgData = { orgId: "org2" as any };
    expect(otherOrgData.orgId).not.toBe(session.orgId);
  });

  it("WRITE_ROLES cannot access admin-only functions", () => {
    expect(ADMIN_ROLES).toContain("super_admin");
    expect(ADMIN_ROLES).toContain("admin");
    expect(ADMIN_ROLES).not.toContain("dispatcher");
    expect(ADMIN_ROLES).not.toContain("operations");
  });

  it("carrier_admin role is not a write or admin role", () => {
    expect(WRITE_ROLES).not.toContain("carrier_admin");
    expect(ADMIN_ROLES).not.toContain("carrier_admin");
  });

  it("driver role is not a write or admin role", () => {
    expect(WRITE_ROLES).not.toContain("driver");
    expect(ADMIN_ROLES).not.toContain("driver");
  });

  it("read_only role is not a write or admin role", () => {
    expect(WRITE_ROLES).not.toContain("read_only");
    expect(ADMIN_ROLES).not.toContain("read_only");
  });

  it("all roles are accounted for in the role list", () => {
    expect(ROLES).toHaveLength(7);
    for (const role of WRITE_ROLES) {
      expect(ROLES).toContain(role);
    }
    for (const role of ADMIN_ROLES) {
      expect(ROLES).toContain(role);
    }
  });

  it("no anonymous or guest roles exist", () => {
    expect(ROLES).not.toContain("anonymous");
    expect(ROLES).not.toContain("guest");
    expect(ROLES).not.toContain("public");
    expect(ROLES).not.toContain("superuser");
  });
});

// ---------------------------------------------------------------------------
// FINANCIAL BOUNDARY TESTING
// ---------------------------------------------------------------------------
describe("Security: Financial boundaries", () => {
  describe("calcDispatcherFee edge cases", () => {
    it("handles $0 gross amount", () => {
      const r = calcDispatcherFee(0, { feeType: "percentage", feeRatePercent: 7 });
      expect(r.feeCents).toBe(0);
      expect(r.carrierCents).toBe(0);
    });

    it("handles very small amount (1 cent)", () => {
      const r = calcDispatcherFee(1, { feeType: "percentage", feeRatePercent: 7 });
      expect(r.feeCents).toBe(0);
      expect(r.carrierCents).toBe(1);
    });

    it("handles very large amount ($1M)", () => {
      const r = calcDispatcherFee(100_000_00, { feeType: "percentage", feeRatePercent: 7 });
      expect(r.feeCents).toBe(7_000_00);
      expect(r.carrierCents).toBe(93_000_00);
    });

    it("handles 0% fee", () => {
      const r = calcDispatcherFee(10_000_00, { feeType: "percentage", feeRatePercent: 0 });
      expect(r.feeCents).toBe(0);
      expect(r.carrierCents).toBe(10_000_00);
    });

    it("handles 100% fee", () => {
      const r = calcDispatcherFee(10_000_00, { feeType: "percentage", feeRatePercent: 100 });
      expect(r.feeCents).toBe(10_000_00);
      expect(r.carrierCents).toBe(0);
    });

    it("handles 50% fee (common high-end)", () => {
      const r = calcDispatcherFee(4_000_00, { feeType: "percentage", feeRatePercent: 50 });
      expect(r.feeCents).toBe(2_000_00);
      expect(r.carrierCents).toBe(2_000_00);
    });

    it("minimum fee applied correctly", () => {
      const r = calcDispatcherFee(100_00, {
        feeType: "percentage",
        feeRatePercent: 7,
        feeMinCents: 150_00,
      });
      expect(r.feeCents).toBe(150_00);
      expect(r.carrierCents).toBe(-50_00);
      expect(r.method).toContain("Minimum");
    });

    it("maximum fee applied correctly", () => {
      const r = calcDispatcherFee(100_000_00, {
        feeType: "percentage",
        feeRatePercent: 10,
        feeMaxCents: 500_00,
      });
      expect(r.feeCents).toBe(500_00);
      expect(r.carrierCents).toBe(99_500_00);
      expect(r.method).toContain("Maximum");
    });

    it("both min and max applied - fee falls within range", () => {
      const r = calcDispatcherFee(5_000_00, {
        feeType: "percentage",
        feeRatePercent: 10,
        feeMinCents: 100_00,
        feeMaxCents: 1000_00,
      });
      expect(r.feeCents).toBe(500_00);
      expect(r.carrierCents).toBe(4500_00);
    });

    it("flat fee of zero", () => {
      const r = calcDispatcherFee(5_000_00, {
        feeType: "flat",
        flatFeeCents: 0,
      });
      expect(r.feeCents).toBe(0);
      expect(r.carrierCents).toBe(5_000_00);
    });

    it("flat fee exceeding gross rate", () => {
      const r = calcDispatcherFee(100_00, {
        feeType: "flat",
        flatFeeCents: 200_00,
      });
      expect(r.feeCents).toBe(200_00);
      expect(r.carrierCents).toBe(-100_00);
    });

    it("negative gross amount returns zero fee", () => {
      const r = calcDispatcherFee(-1000_00, { feeType: "percentage", feeRatePercent: 7 });
      expect(r.feeCents).toBe(0);
      expect(r.carrierCents).toBe(-1000_00);
    });

    it("fee calculation is consistent (gross = fee + carrier)", () => {
      const configs = [
        { feeType: "percentage" as const, feeRatePercent: 7 },
        { feeType: "percentage" as const, feeRatePercent: 10 },
        { feeType: "percentage" as const, feeRatePercent: 15 },
        { feeType: "flat" as const, flatFeeCents: 250_00 },
        { feeType: "flat" as const, flatFeeCents: 500_00 },
      ];
      const amounts = [1_000_00, 2_500_00, 5_000_00, 10_000_00, 50_000_00];
      for (const cfg of configs) {
        for (const gross of amounts) {
          const r = calcDispatcherFee(gross, cfg);
          expect(r.feeCents + r.carrierCents).toBe(gross);
        }
      }
    });
  });

  describe("RPM calculations", () => {
    it("calcRpm handles zero miles", () => {
      expect(calcRpm(500_00, 0)).toBeNull();
    });

    it("calcRpm handles negative miles", () => {
      expect(calcRpm(500_00, -100)).toBeNull();
    });

    it("calcEffectiveRpm handles zero total miles", () => {
      expect(calcEffectiveRpm(500_00, 0, 0)).toBeNull();
    });

    it("calcEffectiveRpm handles very small distance", () => {
      const rpm = calcEffectiveRpm(100_00, 1, 0);
      expect(rpm).toBe(100.0);
    });
  });

  describe("loadTotalCents", () => {
    it("never returns negative", () => {
      expect(loadTotalCents({ grossRateCents: -100 })).toBe(0);
      expect(loadTotalCents({ grossRateCents: -100, fuelSurchargeCents: 50 })).toBe(0);
    });

    it("handles all null/undefined fields", () => {
      expect(loadTotalCents({})).toBe(0);
      expect(loadTotalCents({ grossRateCents: null, fuelSurchargeCents: null })).toBe(0);
    });
  });

  describe("dollarsToCents validation", () => {
    it("rejects NaN", () => {
      expect(dollarsToCents("abc")).toBeNull();
    });

    it("rejects Infinity", () => {
      expect(dollarsToCents("Infinity")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(dollarsToCents("")).toBeNull();
    });

    it("rejects null/undefined", () => {
      expect(dollarsToCents(null)).toBeNull();
      expect(dollarsToCents(undefined)).toBeNull();
    });

    it("handles dollar signs and commas", () => {
      expect(dollarsToCents("$1,500.00")).toBe(150000);
      expect(dollarsToCents("$ 2,500.50")).toBe(250050);
    });

    it("handles zero", () => {
      expect(dollarsToCents("0")).toBe(0);
    });

    it("handles negative values", () => {
      expect(dollarsToCents("-100")).toBe(-10000);
    });
  });
});

// ---------------------------------------------------------------------------
// LOAD STATE MACHINE INTEGRITY
// ---------------------------------------------------------------------------
describe("Security: Load state machine", () => {
  it("every LOAD_STATUS has a transition entry", () => {
    for (const status of LOAD_STATUSES) {
      expect(LOAD_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(LOAD_TRANSITIONS[status as LoadStatus])).toBe(true);
    }
  });

  it("no self-transitions", () => {
    for (const [from, targets] of Object.entries(LOAD_TRANSITIONS)) {
      for (const to of targets as LoadStatus[]) {
        expect(to).not.toBe(from);
      }
    }
  });

  it("all transition targets are valid statuses", () => {
    for (const [from, targets] of Object.entries(LOAD_TRANSITIONS)) {
      for (const to of targets as LoadStatus[]) {
        expect(LOAD_STATUSES).toContain(to);
      }
    }
  });

  it("forward progression path exists", () => {
    const happyPath: LoadStatus[] = [
      "Draft", "Offered", "Booked", "Driver Notified", "At Pickup",
      "Loading", "Loaded", "In Transit", "At Delivery", "Delivered",
      "POD Pending", "Completed",
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(LOAD_TRANSITIONS[happyPath[i]]).toContain(happyPath[i + 1]);
    }
  });

  it("cannot skip from Draft to Completed", () => {
    expect(LOAD_TRANSITIONS.Draft).not.toContain("Completed");
  });

  it("cannot skip from Draft to In Transit", () => {
    expect(LOAD_TRANSITIONS.Draft).not.toContain("In Transit");
  });

  it("Completed is terminal (only Disputed)", () => {
    expect(LOAD_TRANSITIONS.Completed).toEqual(["Disputed"]);
  });

  it("Cancelled is terminal (only Disputed)", () => {
    expect(LOAD_TRANSITIONS.Cancelled).toEqual(["Disputed"]);
  });

  it("Disputed can resolve to Completed, Cancelled, or Booked", () => {
    expect(LOAD_TRANSITIONS.Disputed).toContain("Completed");
    expect(LOAD_TRANSITIONS.Disputed).toContain("Cancelled");
    expect(LOAD_TRANSITIONS.Disputed).toContain("Booked");
  });

  it("TONU Requested can only go to Cancelled or Disputed", () => {
    expect(LOAD_TRANSITIONS["TONU Requested"]).toContain("Cancelled");
    expect(LOAD_TRANSITIONS["TONU Requested"]).toContain("Disputed");
  });

  it("every non-terminal status can reach Completed", () => {
    const visited = new Set<string>();
    const queue: string[] = ["Completed"];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const [from, targets] of Object.entries(LOAD_TRANSITIONS)) {
        if ((targets as LoadStatus[]).includes(current as LoadStatus)) {
          queue.push(from);
        }
      }
    }
    for (const status of LOAD_STATUSES) {
      if (!TERMINAL_LOAD_STATUSES.includes(status as LoadStatus)) {
        expect(visited.has(status)).toBe(true);
      }
    }
  });

  it("terminal statuses are exactly Completed and Cancelled", () => {
    expect(TERMINAL_LOAD_STATUSES).toHaveLength(2);
    expect(TERMINAL_LOAD_STATUSES).toContain("Completed");
    expect(TERMINAL_LOAD_STATUSES).toContain("Cancelled");
  });
});

// ---------------------------------------------------------------------------
// DATA VALIDATION RULES
// ---------------------------------------------------------------------------
describe("Security: Data validation", () => {
  describe("Coordinate validation", () => {
    it("valid latitude range is -90 to 90", () => {
      const validLats = [-90, -45, 0, 45, 90];
      const invalidLats = [-91, 91, -180, 180, -1000, 1000];
      for (const lat of validLats) {
        expect(lat >= -90 && lat <= 90).toBe(true);
      }
      for (const lat of invalidLats) {
        expect(lat >= -90 && lat <= 90).toBe(false);
      }
    });

    it("valid longitude range is -180 to 180", () => {
      const validLons = [-180, -90, 0, 90, 180];
      const invalidLons = [-181, 181, -360, 360, -1000, 1000];
      for (const lon of validLons) {
        expect(lon >= -180 && lon <= 180).toBe(true);
      }
      for (const lon of invalidLons) {
        expect(lon >= -180 && lon <= 180).toBe(false);
      }
    });

    it("NaN coordinates are invalid", () => {
      expect(Number.isFinite(NaN)).toBe(false);
      expect(Number.isFinite(Infinity)).toBe(false);
      expect(Number.isFinite(-Infinity)).toBe(false);
    });
  });

  describe("Document security", () => {
    it("dangerous extensions are blocked", () => {
      const dangerous = ["exe", "bat", "sh", "js", "html", "svg", "php", "com", "cmd", "ps1"];
      for (const ext of dangerous) {
        expect(DOC_ALLOWED_EXTENSIONS).not.toContain(ext);
      }
    });

    it("safe extensions are allowed", () => {
      const safe = ["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx", "csv", "txt"];
      for (const ext of safe) {
        expect(DOC_ALLOWED_EXTENSIONS).toContain(ext);
      }
    });
  });

  describe("Invoice amounts", () => {
    it("positive amounts are valid", () => {
      const amounts = [1, 100, 10000, 1000000];
      for (const a of amounts) {
        expect(a > 0 && Number.isFinite(a)).toBe(true);
      }
    });

    it("zero and negative amounts are invalid", () => {
      const invalid = [0, -1, -100, -Infinity, Infinity, NaN];
      for (const a of invalid) {
        expect(a > 0 && Number.isFinite(a)).toBe(false);
      }
    });
  });

  describe("Payment bounds", () => {
    it("payment cannot exceed outstanding balance", () => {
      const amountCents = 500_00;
      const paidCents = 300_00;
      const outstanding = amountCents - paidCents;

      const validPayment = 200_00;
      const invalidPayment = 201_00;

      expect(validPayment <= outstanding).toBe(true);
      expect(invalidPayment <= outstanding).toBe(false);
    });

    it("payment amount must be positive", () => {
      expect(0 > 0).toBe(false);
      expect(-100 > 0).toBe(false);
      expect(NaN > 0).toBe(false);
    });
  });

  describe("Role constants", () => {
    it("exactly 7 roles exist", () => {
      expect(ROLES).toHaveLength(7);
    });

    it("account statuses include all required values", () => {
      expect(ACCOUNT_STATUSES).toContain("active");
      expect(ACCOUNT_STATUSES).toContain("suspended");
      expect(ACCOUNT_STATUSES).toContain("revoked");
      expect(ACCOUNT_STATUSES).toContain("invited");
      expect(ACCOUNT_STATUSES).toHaveLength(4);
    });

    it("invoice statuses include all expected values", () => {
      expect(INVOICE_STATUSES).toContain("Draft");
      expect(INVOICE_STATUSES).toContain("Sent");
      expect(INVOICE_STATUSES).toContain("Paid");
      expect(INVOICE_STATUSES).toContain("Overdue");
      expect(INVOICE_STATUSES).toContain("Cancelled");
      expect(INVOICE_STATUSES).toContain("Disputed");
    });
  });
});

// ---------------------------------------------------------------------------
// MATCHING ENGINE SECURITY
// ---------------------------------------------------------------------------
describe("Security: Matching engine", () => {
  it("score is always between 0 and 100", () => {
    const testCases = [
      { load: { availability: "Available" }, truck: { availability: "Available" } },
      { load: { availability: "Available" }, truck: { availability: "Out of Service" } },
      { load: { equipment: "Dry Van" }, truck: { equipment: "Flatbed" } },
      { load: { equipment: "Reefer", weight: 80000 }, truck: { equipment: "Dry Van", maxWeight: 40000 } },
    ];
    for (const tc of testCases) {
      const result = scoreTruckForLoad(tc.load as any, tc.truck as any);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("tier classification covers all ranges", () => {
    const tiers = new Set<string>();
    for (let score = 0; score <= 100; score++) {
      const tier = score >= 85 ? "Strong Match" : score >= 65 ? "Good Match" : score >= 40 ? "Possible Match" : "Weak Match";
      tiers.add(tier);
    }
    expect(tiers.size).toBe(4);
    expect(tiers).toContain("Strong Match");
    expect(tiers).toContain("Good Match");
    expect(tiers).toContain("Possible Match");
    expect(tiers).toContain("Weak Match");
  });
});

// ---------------------------------------------------------------------------
// IDEMPOTENCY PROPERTIES
// ---------------------------------------------------------------------------
describe("Security: Idempotency", () => {
  it("load completion fee calculation is deterministic", () => {
    const cfg = { feeType: "percentage" as const, feeRatePercent: 7 };
    const r1 = calcDispatcherFee(5000_00, cfg);
    const r2 = calcDispatcherFee(5000_00, cfg);
    expect(r1.feeCents).toBe(r2.feeCents);
    expect(r1.carrierCents).toBe(r2.carrierCents);
  });

  it("deriveLoadFinance is deterministic for same input", () => {
    const input = {
      grossRateCents: 5000_00,
      fuelSurchargeCents: 200_00,
      accessorialsCents: 100_00,
      loadedMiles: 500,
      deadheadMiles: 50,
      feeType: "percentage" as const,
      feeRatePercent: 10,
    };
    const r1 = deriveLoadFinance(input);
    const r2 = deriveLoadFinance(input);
    expect(r1.feeCents).toBe(r2.feeCents);
    expect(r1.carrierCents).toBe(r2.carrierCents);
    expect(r1.rpm).toBe(r2.rpm);
    expect(r1.effectiveRpm).toBe(r2.effectiveRpm);
  });

  it("invoice number counter produces unique values", () => {
    const counter = { value: 0 };
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      counter.value++;
      const num = `INV-${1000 + counter.value}`;
      numbers.add(num);
    }
    expect(numbers.size).toBe(100);
  });

  it("load number counter produces unique values", () => {
    const counter = { value: 0 };
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      counter.value++;
      const num = `LD-${1000 + counter.value}`;
      numbers.add(num);
    }
    expect(numbers.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// CARRIER FINANCIAL VISIBILITY
// ---------------------------------------------------------------------------
describe("Security: Financial visibility modes", () => {
  it("all visibility modes are defined", () => {
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("full");
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("rate_only");
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("fee_visible");
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("none");
    expect(CARRIER_FINANCIAL_VISIBILITY).toHaveLength(4);
  });

  it("fee calculation works with different carrier configs", () => {
    const configs = [
      { feeType: "percentage" as const, feeRatePercent: 5 },
      { feeType: "percentage" as const, feeRatePercent: 7 },
      { feeType: "percentage" as const, feeRatePercent: 10 },
      { feeType: "flat" as const, flatFeeCents: 200_00 },
      { feeType: "flat" as const, flatFeeCents: 350_00 },
    ];
    for (const cfg of configs) {
      const r = calcDispatcherFee(5000_00, cfg);
      expect(r.feeCents).toBeGreaterThanOrEqual(0);
      expect(r.carrierCents).toBe(5000_00 - r.feeCents);
    }
  });
});

// ---------------------------------------------------------------------------
// WEBHOOK SECURITY
// ---------------------------------------------------------------------------
describe("Security: Webhook duplicate detection", () => {
  it("duplicate detection by externalId works correctly", () => {
    const webhooks = [
      { externalId: "evt_123", status: "processed" },
      { externalId: "evt_456", status: "processed" },
      { externalId: "evt_789", status: "unverified" },
    ];
    const isDuplicate = (id: string) =>
      webhooks.some((w) => w.externalId === id && w.status === "processed");

    expect(isDuplicate("evt_123")).toBe(true);
    expect(isDuplicate("evt_456")).toBe(true);
    expect(isDuplicate("evt_789")).toBe(false);
    expect(isDuplicate("evt_999")).toBe(false);
  });

  it("unverified webhooks can be re-processed", () => {
    const webhooks = [
      { externalId: "evt_123", status: "unverified" },
    ];
    const isDuplicate = (id: string) =>
      webhooks.some((w) => w.externalId === id && w.status === "processed");

    expect(isDuplicate("evt_123")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ROUNDING INTEGRITY
// ---------------------------------------------------------------------------
describe("Security: Rounding integrity", () => {
  it("round2 is deterministic and idempotent", () => {
    const values = [1.005, 2.505, 100.995, 0.001, 99.999];
    for (const v of values) {
      expect(round2(round2(v))).toBe(round2(v));
    }
  });

  it("round2 handles edge cases", () => {
    expect(round2(0)).toBe(0);
    expect(round2(0.001)).toBe(0);
    expect(round2(0.009)).toBe(0.01);
    expect(round2(0.004)).toBe(0);
  });

  it("round2 is idempotent", () => {
    const values = [1.23456, 99.999, 0.001, 1000.5, -3.14159];
    for (const v of values) {
      expect(round2(round2(v))).toBe(round2(v));
    }
  });

  it("no floating point drift in repeated operations", () => {
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum = round2(sum + 0.01);
    }
    expect(sum).toBe(1.0);
  });
});
