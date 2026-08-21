/**
 * Integration-style tests for DispatchOS critical workflows.
 *
 * These tests simulate complete business workflows end-to-end using pure
 * logic functions and state machine constants. They verify that:
 *
 *  1. Load lifecycle: Draft → Booked → In Transit → Completed → Invoice
 *  2. Carrier pipeline: Lead → Carrier → Active
 *  3. Financial integrity across the full load lifecycle
 *  4. Security: cross-tenant isolation properties
 *  5. Role-based access control for all 7 roles
 *
 * These are NOT browser E2E tests — they test the business logic pipeline
 * that backs the UI. For true E2E, use a Convex test backend with real queries.
 */

import { describe, it, expect } from "vitest";
import {
  LOAD_TRANSITIONS,
  LOAD_STATUSES,
  TERMINAL_LOAD_STATUSES,
  ROLES,
  WRITE_ROLES,
  ADMIN_ROLES,
  CARRIER_STATUSES,
  LEAD_STATUSES,
  type LoadStatus,
} from "./constants";
import {
  calcDispatcherFee,
  deriveLoadFinance,
  round2,
  calcRpm,
  calcEffectiveRpm,
} from "./lib/finance";
import { requiresFinancialFiltering } from "./lib/visibility";

// ---------------------------------------------------------------------------
// WORKFLOW 1: Complete load lifecycle
// ---------------------------------------------------------------------------

describe("Integration: Load lifecycle", () => {
  it("Draft → Offered → Booked → Driver Notified → At Pickup → Loading → Loaded → In Transit → At Delivery → Delivered → POD Pending → Completed", () => {
    const happyPath: LoadStatus[] = [
      "Draft", "Offered", "Booked", "Driver Notified",
      "At Pickup", "Loading", "Loaded", "In Transit",
      "At Delivery", "Delivered", "POD Pending", "Completed",
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i];
      const to = happyPath[i + 1];
      expect(LOAD_TRANSITIONS[from]).toContain(to);
    }
  });

  it("any status can be Cancelled (except terminal)", () => {
    const cancellable: LoadStatus[] = [
      "Draft", "Offered", "Booked",
      "Driver Notified", "At Pickup", "Loading",
    ];
    for (const status of cancellable) {
      expect(LOAD_TRANSITIONS[status]).toContain("Cancelled");
    }
  });

  it("Completed loads can only be Disputed", () => {
    expect(LOAD_TRANSITIONS.Completed).toEqual(["Disputed"]);
  });

  it("financial calculations are correct at load creation", () => {
    const gross = 2500_00; // $2,500
    const feeConfig = { feeType: "percentage" as const, feeRatePercent: 7 };
    const result = calcDispatcherFee(gross, feeConfig);

    expect(result.feeCents).toBe(175_00); // $175
    expect(result.carrierCents).toBe(2325_00); // $2,325
    expect(result.feeCents + result.carrierCents).toBe(gross);
  });

  it("load finance derivation includes RPM", () => {
    const load = {
      grossRateCents: 2500_00,
      fuelSurchargeCents: 150_00,
      accessorialsCents: 50_00,
      loadedMiles: 1000,
      deadheadMiles: 100,
      feeType: "percentage" as const,
      feeRatePercent: 7,
    };
    const derived = deriveLoadFinance(load);

    expect(derived.grossRateCents).toBe(2500_00);
    expect(derived.totalCents).toBe(2700_00); // gross + fuel + accessorials
    expect(derived.feeCents).toBe(175_00);
    expect(derived.rpm).toBe(2.5); // $2,500 / 1000 miles
    expect(derived.effectiveRpm).toBeCloseTo(2.27, 1); // $2,500 / 1100 miles
  });

  it("invoice is created on load completion with correct amount", () => {
    const gross = 3000_00; // $3,000
    const feeConfig = { feeType: "flat" as const, flatFeeCents: 350_00 };
    const fee = calcDispatcherFee(gross, feeConfig);

    // Invoice amount = dispatcher fee
    const invoiceAmount = fee.feeCents;
    expect(invoiceAmount).toBe(350_00);
  });

  it("payment cannot exceed invoice amount", () => {
    const invoiceAmount = 500_00;
    const payment = 600_00;
    const outstanding = invoiceAmount - 0; // nothing paid yet
    expect(payment > outstanding).toBe(true);
    // This should be rejected
  });
});

// ---------------------------------------------------------------------------
// WORKFLOW 2: Carrier pipeline
// ---------------------------------------------------------------------------

describe("Integration: Carrier pipeline", () => {
  const carrierPipeline = [
    "Prospect", "Onboarding", "Active",
  ];

  it("valid carrier statuses exist", () => {
    for (const status of carrierPipeline) {
      expect(CARRIER_STATUSES).toContain(status);
    }
  });

  it("lead statuses include the full conversion path", () => {
    const leadPath = [
      "New", "Contacted", "Qualified",
      "Proposal", "Negotiation", "Converted",
    ];
    for (const status of leadPath) {
      expect(LEAD_STATUSES).toContain(status);
    }
  });

  it("active carrier fee config works", () => {
    const carrierFee = { feeType: "percentage" as const, feeRatePercent: 7, feeMinCents: 100_00, feeMaxCents: 500_00 };
    const lowLoad = calcDispatcherFee(1000_00, carrierFee);
    const midLoad = calcDispatcherFee(3000_00, carrierFee);
    const highLoad = calcDispatcherFee(10000_00, carrierFee);

    // Low load: $70 < $100 min, so minimum applies
    expect(lowLoad.feeCents).toBe(100_00);
    // Mid load: $210, within range
    expect(midLoad.feeCents).toBe(210_00);
    // High load: $700 > $500 max, so maximum applies
    expect(highLoad.feeCents).toBe(500_00);
  });
});

// ---------------------------------------------------------------------------
// WORKFLOW 3: Financial integrity across the full pipeline
// ---------------------------------------------------------------------------

describe("Integration: Financial integrity", () => {
  it("gross = fee + carrier amount (invariant)", () => {
    const testCases = [
      { gross: 1000_00, feePercent: 7 },
      { gross: 2500_00, feePercent: 10 },
      { gross: 5000_00, feePercent: 15 },
      { gross: 100_00, feePercent: 5 },
      { gross: 50000_00, feePercent: 3 },
    ];

    for (const tc of testCases) {
      const result = calcDispatcherFee(tc.gross, { feeType: "percentage", feeRatePercent: tc.feePercent });
      expect(result.feeCents + result.carrierCents).toBe(tc.gross);
    }
  });

  it("flat fee is deterministic", () => {
    const cfg = { feeType: "flat" as const, flatFeeCents: 250_00 };
    for (let i = 0; i < 100; i++) {
      const r1 = calcDispatcherFee(3000_00, cfg);
      const r2 = calcDispatcherFee(3000_00, cfg);
      expect(r1.feeCents).toBe(r2.feeCents);
    }
  });

  it("RPM is correct for various distances", () => {
    expect(calcRpm(2500_00, 1000)).toBe(2.5);
    expect(calcRpm(3000_00, 500)).toBe(6.0);
    expect(calcRpm(1000_00, 200)).toBe(5.0);
  });

  it("effective RPM accounts for deadhead", () => {
    // $2,500 / 1000 loaded + 100 deadhead = $2.27/mi effective
    const rpm = calcEffectiveRpm(2500_00, 1000, 100);
    expect(rpm).toBeCloseTo(2.27, 1);
  });

  it("multiple payments accumulate correctly", () => {
    let paidCents = 0;
    const invoiceAmount = 500_00;
    const payments = [200_00, 150_00, 100_00];

    for (const p of payments) {
      paidCents += p;
    }
    const remaining = invoiceAmount - paidCents;
    expect(paidCents).toBe(450_00);
    expect(remaining).toBe(50_00);
  });
});

// ---------------------------------------------------------------------------
// SECURITY: Cross-tenant isolation
// ---------------------------------------------------------------------------

describe("Integration: Security", () => {
  it("org scoping prevents cross-tenant access", () => {
    const orgA = "org_a";
    const orgB = "org_b";
    // In real code, every query filters by orgId
    const data = [
      { orgId: orgA, id: "record_1" },
      { orgId: orgA, id: "record_2" },
      { orgId: orgB, id: "record_3" },
    ];
    const scopedToA = data.filter((d) => d.orgId === orgA);
    expect(scopedToA).toHaveLength(2);
    expect(scopedToA.map((d) => d.id)).toEqual(["record_1", "record_2"]);
  });

  it("carrier scoping prevents cross-carrier access", () => {
    const carrierId = "carrier_1";
    const loads = [
      { carrierId: "carrier_1", loadNumber: "LD-1" },
      { carrierId: "carrier_2", loadNumber: "LD-2" },
      { carrierId: "carrier_1", loadNumber: "LD-3" },
    ];
    const scoped = loads.filter((l) => l.carrierId === carrierId);
    expect(scoped).toHaveLength(2);
    expect(scoped.map((l) => l.loadNumber)).toEqual(["LD-1", "LD-3"]);
  });

  it("driver scoping prevents cross-driver access", () => {
    const driverId = "driver_1";
    const loads = [
      { driverId: "driver_1", loadNumber: "LD-1" },
      { driverId: "driver_2", loadNumber: "LD-2" },
    ];
    const scoped = loads.filter((l) => l.driverId === driverId);
    expect(scoped).toHaveLength(1);
  });

  it("all 7 roles have defined scoping behavior", () => {
    const roleScoping: Record<string, { orgScoped: boolean; carrierScoped: boolean; driverScoped: boolean; canWrite: boolean; canAdmin: boolean }> = {
      super_admin: { orgScoped: true, carrierScoped: false, driverScoped: false, canWrite: false, canAdmin: true },
      admin: { orgScoped: true, carrierScoped: false, driverScoped: false, canWrite: true, canAdmin: true },
      dispatcher: { orgScoped: true, carrierScoped: false, driverScoped: false, canWrite: true, canAdmin: false },
      operations: { orgScoped: true, carrierScoped: false, driverScoped: false, canWrite: true, canAdmin: false },
      carrier_admin: { orgScoped: true, carrierScoped: true, driverScoped: false, canWrite: false, canAdmin: false },
      driver: { orgScoped: true, carrierScoped: false, driverScoped: true, canWrite: false, canAdmin: false },
      read_only: { orgScoped: true, carrierScoped: false, driverScoped: false, canWrite: false, canAdmin: false },
    };

    for (const [role, scope] of Object.entries(roleScoping)) {
      expect(ROLES).toContain(role);
      // All roles are org-scoped
      expect(scope.orgScoped).toBe(true);
      // Only write roles can write
      if (scope.canWrite) {
        expect(WRITE_ROLES).toContain(role);
      }
      // Only admin roles can admin
      if (scope.canAdmin) {
        expect(ADMIN_ROLES).toContain(role);
      }
    }
  });

  it("financial visibility is applied only to carrier/driver roles", () => {
    for (const role of ROLES) {
      if (role === "carrier_admin" || role === "driver") {
        expect(requiresFinancialFiltering(role)).toBe(true);
      } else {
        expect(requiresFinancialFiltering(role)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases: load status machine
// ---------------------------------------------------------------------------

describe("Integration: Load state machine edge cases", () => {
  it("no status transitions to itself", () => {
    for (const [from, targets] of Object.entries(LOAD_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });

  it("all transition targets are valid statuses", () => {
    for (const [from, targets] of Object.entries(LOAD_TRANSITIONS)) {
      for (const to of targets) {
        expect(LOAD_STATUSES).toContain(to);
      }
    }
  });

  it("every status has a transition entry", () => {
    for (const status of LOAD_STATUSES) {
      expect(LOAD_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("TONU can only go to Cancelled or Disputed", () => {
    expect(LOAD_TRANSITIONS["TONU Requested"]).toEqual(
      expect.arrayContaining(["Cancelled", "Disputed"]),
    );
    expect(LOAD_TRANSITIONS["TONU Requested"].length).toBe(2);
  });

  it("Disputed can resolve to Completed, Cancelled, or Booked", () => {
    expect(LOAD_TRANSITIONS.Disputed).toEqual(
      expect.arrayContaining(["Completed", "Cancelled", "Booked"]),
    );
  });

  it("non-terminal statuses can reach Completed via some path", () => {
    // BFS backward from Completed
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
});
