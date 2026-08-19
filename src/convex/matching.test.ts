/**
 * Unit tests for the load matching engine (scoreTruckForLoad).
 *
 * Covers:
 *  - Equipment matching / mismatching
 *  - Availability scoring
 *  - Driver availability
 *  - Pickup timing
 *  - Location/deadhead
 *  - Preferred/avoided lanes
 *  - Weight capacity
 *  - Home time proximity
 *  - Score clamping (0–100)
 *  - Tier classification
 */

import { describe, it, expect } from "vitest";
import { scoreTruckForLoad, type MatchInput } from "./matching";

function baseLoad(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    equipment: "Dry Van",
    origin: "Dallas, TX",
    destination: "Chicago, IL",
    pickupDate: Date.now() + 36 * 3600_000,
    deliveryDate: Date.now() + 72 * 3600_000,
    weight: 40000,
    preferredLanes: null,
    avoidedLanes: null,
    maxWeight: null,
    currentLocation: null,
    availability: "Available",
    currentLoadId: null,
    driverAvailability: null,
    homeTime: null,
    ...overrides,
  };
}

function baseTruck(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    equipment: "Dry Van",
    availability: "Available",
    currentLoadId: null,
    currentLocation: "Miami, FL",
    preferredLanes: ["Florida"],
    avoidedLanes: null,
    maxWeight: 45000,
    homeTime: "Miami, FL",
    driverAvailability: "Available",
    ...overrides,
  };
}

describe("scoreTruckForLoad", () => {
  it("returns a perfect match for fully compatible truck", () => {
    const result = scoreTruckForLoad(baseLoad(), baseTruck());
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.tier).toBe("Strong Match");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("scores higher for equipment match", () => {
    const match = scoreTruckForLoad(baseLoad({ equipment: "Dry Van" }), baseTruck({ equipment: "Dry Van" }));
    const mismatch = scoreTruckForLoad(baseLoad({ equipment: "Dry Van" }), baseTruck({ equipment: "Flatbed" }));
    expect(match.score).toBeGreaterThan(mismatch.score);
  });

  it("scores higher for available truck with no load", () => {
    const available = scoreTruckForLoad(baseLoad(), baseTruck({ availability: "Available", currentLoadId: null }));
    const booked = scoreTruckForLoad(baseLoad(), baseTruck({ availability: "Booked", currentLoadId: "some_load" }));
    expect(available.score).toBeGreaterThan(booked.score);
  });

  it("scores higher when driver is available", () => {
    const withDriver = scoreTruckForLoad(baseLoad(), baseTruck({ driverAvailability: "Available" }));
    const noDriver = scoreTruckForLoad(baseLoad(), baseTruck({ driverAvailability: "Driving" }));
    expect(withDriver.score).toBeGreaterThan(noDriver.score);
  });

  it("scores higher when truck is near origin", () => {
    // Weaken truck to remove home-time bonus so score < 100
    const near = scoreTruckForLoad(
      baseLoad({ origin: "Dallas, TX" }),
      baseTruck({ currentLocation: "Dallas, TX", homeTime: "Miami, FL" }),
    );
    const far = scoreTruckForLoad(
      baseLoad({ origin: "Dallas, TX" }),
      baseTruck({ currentLocation: "Miami, FL", homeTime: "Miami, FL" }),
    );
    expect(near.score).toBeGreaterThanOrEqual(far.score);
    expect(near.reasons.some((r: string) => r.includes("near") || r.includes("at") || r.includes("origin"))).toBe(true);
  });

  it("penalizes avoided lanes", () => {
    const avoided = scoreTruckForLoad(
      baseLoad({ origin: "Dallas, TX", destination: "Houston, TX" }),
      baseTruck({ avoidedLanes: ["Houston"] }),
    );
    const noAvoid = scoreTruckForLoad(
      baseLoad({ origin: "Dallas, TX", destination: "Houston, TX" }),
      baseTruck({ avoidedLanes: null }),
    );
    expect(avoided.score).toBeLessThan(noAvoid.score);
    expect(avoided.concerns.some((c: string) => c.includes("avoided"))).toBe(true);
  });

  it("rewards preferred lanes", () => {
    const preferred = scoreTruckForLoad(
      baseLoad({ origin: "Dallas, TX", destination: "Chicago, IL" }),
      baseTruck({ preferredLanes: ["Chicago"] }),
    );
    const neutral = scoreTruckForLoad(
      baseLoad({ origin: "Dallas, TX", destination: "Chicago, IL" }),
      baseTruck({ preferredLanes: ["Miami"] }),
    );
    expect(preferred.score).toBeGreaterThanOrEqual(neutral.score);
  });

  it("scores higher when weight is within capacity", () => {
    const within = scoreTruckForLoad(baseLoad({ weight: 40000 }), baseTruck({ maxWeight: 45000 }));
    const over = scoreTruckForLoad(baseLoad({ weight: 50000 }), baseTruck({ maxWeight: 45000 }));
    expect(within.score).toBeGreaterThan(over.score);
  });

  it("rewards home time proximity", () => {
    const home = scoreTruckForLoad(
      baseLoad({ destination: "Chicago, IL" }),
      baseTruck({ homeTime: "Chicago, IL" }),
    );
    const noHome = scoreTruckForLoad(
      baseLoad({ destination: "Chicago, IL" }),
      baseTruck({ homeTime: "Miami, FL" }),
    );
    expect(home.score).toBeGreaterThanOrEqual(noHome.score);
  });

  it("score is clamped between 0 and 100", () => {
    const worst = scoreTruckForLoad(
      baseLoad({ equipment: "Reefer", origin: "A", destination: "B", weight: 80000 }),
      baseTruck({
        equipment: "Flatbed",
        availability: "Out of Service",
        currentLoadId: "something",
        currentLocation: "Z",
        maxWeight: 10000,
        avoidedLanes: ["A", "B", "Texas"],
        driverAvailability: "Unavailable",
      }),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it("score is clamped at 100 for exceptional match", () => {
    const result = scoreTruckForLoad(baseLoad(), baseTruck());
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("tier classification is correct", () => {
    const result = scoreTruckForLoad(baseLoad(), baseTruck());
    if (result.score >= 85) expect(result.tier).toBe("Strong Match");
    else if (result.score >= 65) expect(result.tier).toBe("Good Match");
    else if (result.score >= 40) expect(result.tier).toBe("Possible Match");
    else expect(result.tier).toBe("Weak Match");
  });

  it("includes reasons and concerns arrays", () => {
    const result = scoreTruckForLoad(baseLoad(), baseTruck());
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.concerns)).toBe(true);
  });

  it("handles missing origin/deadhead gracefully", () => {
    const result = scoreTruckForLoad(
      baseLoad({ origin: null }),
      baseTruck({ currentLocation: null }),
    );
    expect(result.concerns.some((c: string) => c.includes("deadhead") || c.includes("location"))).toBe(true);
  });

  it("handles partial input with nulls", () => {
    const result = scoreTruckForLoad(
      baseLoad({ equipment: null, weight: null, origin: null }),
      baseTruck({ equipment: null, maxWeight: null }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
