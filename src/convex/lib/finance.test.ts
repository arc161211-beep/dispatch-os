/**
 * Unit tests for financial calculations in DispatchOS.
 *
 * Covers:
 *  - calcDispatcherFee (percentage, flat, min/max bounds, null config)
 *  - calcRpm / calcEffectiveRpm
 *  - loadTotalCents
 *  - deriveLoadFinance
 *  - dollarsToCents / centsToDollars / formatCents / formatRpm
 *  - round2
 */

import { describe, it, expect } from "vitest";
import {
  calcDispatcherFee,
  calcRpm,
  calcEffectiveRpm,
  loadTotalCents,
  deriveLoadFinance,
  dollarsToCents,
  centsToDollars,
  formatCents,
  formatRpm,
  round2,
} from "./finance";

// ---------------------------------------------------------------------------
// calcDispatcherFee
// ---------------------------------------------------------------------------
describe("calcDispatcherFee", () => {
  it("returns zero fee when config is null", () => {
    const r = calcDispatcherFee(100_00, null);
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(100_00);
    expect(r.method).toBe("No fee configured");
  });

  it("returns zero fee when config is undefined", () => {
    const r = calcDispatcherFee(100_00, undefined);
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(100_00);
  });

  it("returns zero fee when gross is zero", () => {
    const r = calcDispatcherFee(0, { feeType: "percentage", feeRatePercent: 10 });
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(0);
  });

  it("returns zero fee when gross is negative", () => {
    const r = calcDispatcherFee(-500, { feeType: "percentage", feeRatePercent: 10 });
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(-500);
  });

  it("calculates 10% fee correctly", () => {
    const r = calcDispatcherFee(500_00, { feeType: "percentage", feeRatePercent: 10 });
    expect(r.feeCents).toBe(50_00); // $500 * 10% = $50
    expect(r.carrierCents).toBe(450_00);
    expect(r.method).toBe("10% of gross");
  });

  it("calculates 15% fee correctly", () => {
    const r = calcDispatcherFee(3200_00, { feeType: "percentage", feeRatePercent: 15 });
    expect(r.feeCents).toBe(480_00); // $3200 * 15% = $480
    expect(r.carrierCents).toBe(2720_00);
  });

  it("applies minimum fee when percentage result is below minimum", () => {
    const r = calcDispatcherFee(1000_00, {
      feeType: "percentage",
      feeRatePercent: 10,
      feeMinCents: 200_00, // minimum $200
    });
    // 10% of $1000 = $100, but minimum is $200
    expect(r.feeCents).toBe(200_00);
    expect(r.carrierCents).toBe(800_00);
    expect(r.method).toContain("Minimum");
  });

  it("applies maximum fee when percentage result exceeds maximum", () => {
    const r = calcDispatcherFee(10000_00, {
      feeType: "percentage",
      feeRatePercent: 15,
      feeMaxCents: 500_00, // cap at $500
    });
    // 15% of $10000 = $1500, but max is $500
    expect(r.feeCents).toBe(500_00);
    expect(r.carrierCents).toBe(9500_00);
    expect(r.method).toContain("Maximum");
  });

  it("does not apply bounds when fee is within range", () => {
    const r = calcDispatcherFee(5000_00, {
      feeType: "percentage",
      feeRatePercent: 10,
      feeMinCents: 100_00,
      feeMaxCents: 1000_00,
    });
    // 10% of $5000 = $500, within bounds
    expect(r.feeCents).toBe(500_00);
    expect(r.carrierCents).toBe(4500_00);
    expect(r.method).toBe("10% of gross");
  });

  it("calculates flat fee correctly", () => {
    const r = calcDispatcherFee(5000_00, {
      feeType: "flat",
      flatFeeCents: 350_00,
    });
    expect(r.feeCents).toBe(350_00);
    expect(r.carrierCents).toBe(4650_00);
    expect(r.method).toContain("Flat fee");
  });

  it("flat fee with zero flatFeeCents", () => {
    const r = calcDispatcherFee(5000_00, {
      feeType: "flat",
      flatFeeCents: 0,
    });
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(5000_00);
  });

  it("flat fee with missing flatFeeCents defaults to 0", () => {
    const r = calcDispatcherFee(5000_00, { feeType: "flat" });
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(5000_00);
  });

  it("rounds percentage fee to nearest cent", () => {
    // $1333.33 * 10% = $133.333 → rounds to $133.33
    const r = calcDispatcherFee(1333_33, { feeType: "percentage", feeRatePercent: 10 });
    expect(r.feeCents).toBe(133_33);
    expect(r.carrierCents).toBe(1200_00);
  });

  it("handles very small gross amounts", () => {
    const r = calcDispatcherFee(1, { feeType: "percentage", feeRatePercent: 10 });
    // 1 cent * 10% = 0.1 → rounds to 0
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calcRpm
// ---------------------------------------------------------------------------
describe("calcRpm", () => {
  it("calculates RPM correctly", () => {
    expect(calcRpm(500_00, 250)).toBe(2.0); // $500 / 250 mi = $2.00/mi
  });

  it("returns null when miles is null", () => {
    expect(calcRpm(500_00, null)).toBeNull();
  });

  it("returns null when miles is undefined", () => {
    expect(calcRpm(500_00, undefined)).toBeNull();
  });

  it("returns null when miles is zero", () => {
    expect(calcRpm(500_00, 0)).toBeNull();
  });

  it("returns null when miles is negative", () => {
    expect(calcRpm(500_00, -10)).toBeNull();
  });

  it("handles fractional RPM", () => {
    expect(calcRpm(375_00, 200)).toBe(1.88); // $375 / 200 = $1.875 → rounded to 1.88
  });
});

// ---------------------------------------------------------------------------
// calcEffectiveRpm
// ---------------------------------------------------------------------------
describe("calcEffectiveRpm", () => {
  it("calculates effective RPM with both miles", () => {
    // $500 / (250 + 50) = $1.67/mi
    expect(calcEffectiveRpm(500_00, 250, 50)).toBe(1.67);
  });

  it("returns null when total miles is zero", () => {
    expect(calcEffectiveRpm(500_00, 0, 0)).toBeNull();
  });

  it("returns null when all miles are null", () => {
    expect(calcEffectiveRpm(500_00, null, null)).toBeNull();
  });

  it("handles only loaded miles", () => {
    expect(calcEffectiveRpm(500_00, 250, null)).toBe(2.0);
  });

  it("handles only deadhead miles", () => {
    expect(calcEffectiveRpm(500_00, null, 250)).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// loadTotalCents
// ---------------------------------------------------------------------------
describe("loadTotalCents", () => {
  it("sums all components", () => {
    expect(loadTotalCents({ grossRateCents: 500_00, fuelSurchargeCents: 50_00, accessorialsCents: 25_00 })).toBe(575_00);
  });

  it("handles missing fields", () => {
    expect(loadTotalCents({})).toBe(0);
    expect(loadTotalCents({ grossRateCents: 300_00 })).toBe(300_00);
  });

  it("returns 0 for negative total", () => {
    expect(loadTotalCents({ grossRateCents: -100 })).toBe(0);
  });

  it("handles null fields", () => {
    expect(loadTotalCents({ grossRateCents: null, fuelSurchargeCents: null })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deriveLoadFinance
// ---------------------------------------------------------------------------
describe("deriveLoadFinance", () => {
  it("derives all fields from a complete load", () => {
    const r = deriveLoadFinance({
      grossRateCents: 5000_00,
      fuelSurchargeCents: 200_00,
      accessorialsCents: 100_00,
      loadedMiles: 500,
      deadheadMiles: 50,
      feeType: "percentage",
      feeRatePercent: 10,
      feeMinCents: 0,
      feeMaxCents: 1000_00,
      flatFeeCents: 0,
    });

    expect(r.grossRateCents).toBe(5000_00);
    expect(r.totalCents).toBe(5300_00);
    expect(r.feeCents).toBe(500_00); // 10% of $5000
    // carrierCents = (gross - fee) + fuel + accessorials = 4500 + 200 + 100 = 4800
    expect(r.carrierCents).toBe(4800_00);
    expect(r.rpm).toBe(10.0); // $5000 / 500mi
    expect(r.effectiveRpm).toBe(9.09); // $5000 / 550mi
  });

  it("handles minimal input", () => {
    const r = deriveLoadFinance({});
    expect(r.grossRateCents).toBe(0);
    expect(r.totalCents).toBe(0);
    expect(r.feeCents).toBe(0);
    expect(r.carrierCents).toBe(0);
    expect(r.rpm).toBeNull();
    expect(r.effectiveRpm).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dollarsToCents / centsToDollars
// ---------------------------------------------------------------------------
describe("dollarsToCents", () => {
  it("converts standard dollar string", () => {
    expect(dollarsToCents("2500.50")).toBe(250050);
  });

  it("converts dollar string with commas", () => {
    expect(dollarsToCents("1,234.56")).toBe(123456);
  });

  it("converts plain number", () => {
    expect(dollarsToCents(100)).toBe(10000);
  });

  it("returns null for empty string", () => {
    expect(dollarsToCents("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(dollarsToCents(null)).toBeNull();
    expect(dollarsToCents(undefined)).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(dollarsToCents("abc")).toBeNull();
  });

  it("handles zero", () => {
    expect(dollarsToCents("0")).toBe(0);
  });

  it("handles string with $ sign and spaces", () => {
    expect(dollarsToCents("$ 1,500.00")).toBe(150000);
  });
});

describe("centsToDollars", () => {
  it("converts cents to dollars", () => {
    expect(centsToDollars(250050)).toBe(2500.5);
  });

  it("returns 0 for null/undefined", () => {
    expect(centsToDollars(null)).toBe(0);
    expect(centsToDollars(undefined)).toBe(0);
  });
});

describe("formatCents", () => {
  it("formats positive amount", () => {
    expect(formatCents(50000)).toBe("$500.00");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats null as $0.00", () => {
    expect(formatCents(null)).toBe("$0.00");
  });
});

describe("formatRpm", () => {
  it("formats RPM value", () => {
    expect(formatRpm(2.5)).toBe("$2.50/mi");
  });

  it("returns dash for null", () => {
    expect(formatRpm(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatRpm(undefined)).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// round2
// ---------------------------------------------------------------------------
describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    // IEEE 754 floating-point: these values are NOT exact in binary.
    // round2(n) = Math.round(n * 100) / 100
    expect(round2(1.005)).toBe(1.0);      // 1.005*100 = 100.4999... → 100
    expect(round2(1.004)).toBe(1.0);
    expect(round2(2.675)).toBe(2.68);      // 2.675*100 = 267.50000000000006 → 268
    expect(round2(1.015)).toBe(1.02);      // 1.015*100 = 101.50000000000001 → 102
    expect(round2(3.14159)).toBe(3.14);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("returns integers unchanged", () => {
    expect(round2(5)).toBe(5);
  });

  it("rounds negative numbers", () => {
    // Math.round(-101.5) = -101 in JS (rounds toward +Infinity for .5)
    expect(round2(-1.005)).toBe(-1.0);
    expect(round2(-1.015)).toBe(-1.01);
    expect(round2(-3.14159)).toBe(-3.14);
  });
});
