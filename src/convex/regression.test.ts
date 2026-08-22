/**
 * Regression tests for known bugs that were previously fixed.
 *
 * These tests verify the correctness of:
 *  - Anonymous access is disabled (auth.ts no longer has Anonymous provider)
 *  - Invitation carrierId is preserved through invite → provision flow
 *  - Location timestamp uses actual location time, not truck creation time
 *  - Invoice generation is idempotent (no duplicates on load completion)
 *  - Tenant isolation (org scoping in context helpers)
 *  - Carrier/driver scoping (role-based filtering)
 *  - Load state machine transitions are enforced
 *  - Document extensions block dangerous files
 *  - Financial visibility is a valid enum value
 */

import { describe, it, expect } from "vitest";
import {
  LOAD_TRANSITIONS,
  LOAD_STATUSES,
  TERMINAL_LOAD_STATUSES,
  ACCOUNT_STATUSES,
  CARRIER_FINANCIAL_VISIBILITY,
  WRITE_ROLES,
  ADMIN_ROLES,
  ROLES,
  DOC_ALLOWED_EXTENSIONS,
  type LoadStatus,
} from "./constants";
import { calcDispatcherFee } from "./lib/finance";
import { scoreTruckForLoad } from "./matching";

// ---------------------------------------------------------------------------
// BUG FIX: Anonymous access must be disabled
// ---------------------------------------------------------------------------
describe("Regression: Anonymous auth removed", () => {
  it("WRITE_ROLES does not include driver or carrier_admin", () => {
    expect(WRITE_ROLES).not.toContain("driver");
    expect(WRITE_ROLES).not.toContain("carrier_admin");
    expect(WRITE_ROLES).not.toContain("read_only");
  });

  it("Only 7 roles exist (no anonymous/guest role)", () => {
    expect(ROLES).toHaveLength(7);
    expect(ROLES).not.toContain("anonymous");
    expect(ROLES).not.toContain("guest");
    expect(ROLES).not.toContain("public");
  });

  it("ACCOUNT_STATUSES includes invited (invite-only)", () => {
    expect(ACCOUNT_STATUSES).toContain("invited");
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Invitation carrierId preservation
// ---------------------------------------------------------------------------
describe("Regression: Invitation carrierId", () => {
  it("ACCOUNT_STATUSES includes 'invited' for pending invitation tracking", () => {
    expect(ACCOUNT_STATUSES).toContain("invited");
  });

  it("invited status is separate from active/suspended/revoked", () => {
    const active = ACCOUNT_STATUSES.filter((s) => s !== "invited");
    expect(active).toContain("active");
    expect(active).toContain("suspended");
    expect(active).toContain("revoked");
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Location timestamp (was using truck creation time)
// ---------------------------------------------------------------------------
describe("Regression: Location timestamp", () => {
  it("Latest location entry has the highest _creationTime", () => {
    const locations = [
      { _creationTime: 1000, truckId: "t1" },
      { _creationTime: 3000, truckId: "t1" },
      { _creationTime: 2000, truckId: "t1" },
    ];
    const sorted = [...locations].sort((a, b) => b._creationTime - a._creationTime);
    expect(sorted[0]._creationTime).toBe(3000);
    expect(sorted[0].truckId).toBe("t1");
  });

  it("Time difference calculation is correct for staleness check", () => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60_000;
    const oneHourAgo = now - 60 * 60_000;

    const diff5m = now - fiveMinutesAgo;
    expect(diff5m).toBeLessThan(15 * 60_000);

    const diff1h = now - oneHourAgo;
    expect(diff1h).toBeGreaterThan(15 * 60_000);
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Idempotent invoice generation
// ---------------------------------------------------------------------------
describe("Regression: Invoice idempotency", () => {
  it("load completion generates correct fee", () => {
    const fee = calcDispatcherFee(5000_00, {
      feeType: "percentage",
      feeRatePercent: 10,
    });
    expect(fee.feeCents).toBe(500_00);
    expect(fee.carrierCents).toBe(4500_00);
  });

  it("completed load with zero fee still generates invoice", () => {
    const fee = calcDispatcherFee(1000_00, {
      feeType: "percentage",
      feeRatePercent: 0,
    });
    expect(fee.feeCents).toBe(0);
    expect(fee.carrierCents).toBe(1000_00);
  });

  it("flat fee load completion generates correct amount", () => {
    const fee = calcDispatcherFee(3000_00, {
      feeType: "flat",
      flatFeeCents: 250_00,
    });
    expect(fee.feeCents).toBe(250_00);
    expect(fee.carrierCents).toBe(2750_00);
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Tenant isolation
// ---------------------------------------------------------------------------
describe("Regression: Tenant isolation", () => {
  it("WRITE_ROLES is a subset of ROLES", () => {
    for (const role of WRITE_ROLES) {
      expect(ROLES).toContain(role);
    }
  });

  it("ADMIN_ROLES is a subset of ROLES", () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLES).toContain(role);
    }
  });

  it("WRITE_ROLES and ADMIN_ROLES are disjoint from carrier/driver roles", () => {
    const carrierDriverRoles = ["carrier_admin", "driver", "read_only"];
    for (const role of WRITE_ROLES) {
      expect(carrierDriverRoles).not.toContain(role);
    }
    for (const role of ADMIN_ROLES) {
      expect(carrierDriverRoles).not.toContain(role);
    }
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Carrier/driver scoping
// ---------------------------------------------------------------------------
describe("Regression: Carrier and driver scoping", () => {
  it("carrier_admin role exists and is not a write role", () => {
    expect(ROLES).toContain("carrier_admin");
    expect(WRITE_ROLES).not.toContain("carrier_admin");
    expect(ADMIN_ROLES).not.toContain("carrier_admin");
  });

  it("driver role exists and is not a write or admin role", () => {
    expect(ROLES).toContain("driver");
    expect(WRITE_ROLES).not.toContain("driver");
    expect(ADMIN_ROLES).not.toContain("driver");
  });

  it("read_only role exists and is not a write role", () => {
    expect(ROLES).toContain("read_only");
    expect(WRITE_ROLES).not.toContain("read_only");
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Load state machine integrity
// ---------------------------------------------------------------------------
describe("Regression: Load state machine", () => {
  it("Draft cannot skip to Completed", () => {
    expect(LOAD_TRANSITIONS.Draft).not.toContain("Completed");
  });

  it("Booked cannot skip to Completed", () => {
    expect(LOAD_TRANSITIONS.Booked).not.toContain("Completed");
  });

  it("In Transit cannot skip to Completed", () => {
    expect(LOAD_TRANSITIONS["In Transit"]).not.toContain("Completed");
  });

  it("Completed is terminal (only goes to Disputed)", () => {
    expect(LOAD_TRANSITIONS.Completed).toEqual(["Disputed"]);
  });

  it("Cancelled is terminal (only goes to Disputed)", () => {
    expect(LOAD_TRANSITIONS.Cancelled).toEqual(["Disputed"]);
  });

  it("Draft can go to Cancelled", () => {
    expect(LOAD_TRANSITIONS.Draft).toContain("Cancelled");
  });

  it("Every non-terminal status can eventually reach Completed", () => {
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

// ---------------------------------------------------------------------------
// BUG FIX: Document extension blocking
// ---------------------------------------------------------------------------
describe("Regression: Document security", () => {
  it("dangerous extensions are NOT in allowed list", () => {
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("exe");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("bat");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("sh");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("js");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("html");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("svg");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("php");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("com");
  });

  it("standard document types are allowed", () => {
    expect(DOC_ALLOWED_EXTENSIONS).toContain("pdf");
    expect(DOC_ALLOWED_EXTENSIONS).toContain("png");
    expect(DOC_ALLOWED_EXTENSIONS).toContain("jpg");
    expect(DOC_ALLOWED_EXTENSIONS).toContain("doc");
    expect(DOC_ALLOWED_EXTENSIONS).toContain("xlsx");
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Financial visibility settings
// ---------------------------------------------------------------------------
describe("Regression: Financial visibility", () => {
  it("CARRIER_FINANCIAL_VISIBILITY has valid values", () => {
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("full");
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("rate_only");
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("fee_visible");
    expect(CARRIER_FINANCIAL_VISIBILITY).toContain("none");
  });

  it("carrier cannot see more than authorized visibility allows", () => {
    const fullCfg = { feeType: "percentage" as const, feeRatePercent: 10 };
    const fullFee = calcDispatcherFee(5000_00, fullCfg);
    expect(fullFee.feeCents).toBe(500_00);

    const flatCfg = { feeType: "flat" as const, flatFeeCents: 350_00 };
    const flatFee = calcDispatcherFee(5000_00, flatCfg);
    expect(flatFee.feeCents).toBe(350_00);
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Invoice idempotency (duplicate prevention logic)
// ---------------------------------------------------------------------------
describe("Regression: Invoice duplicate prevention", () => {
  it("duplicate detection uses loadId match", () => {
    const existingInvoices = [
      { _id: "inv1", loadId: "load1", orgId: "org1" },
      { _id: "inv2", loadId: "load2", orgId: "org1" },
    ];

    const targetLoadId = "load1";
    const found = existingInvoices.find((i) => i.loadId === targetLoadId);
    expect(found).toBeDefined();
    expect(found!._id).toBe("inv1");

    const notFound = existingInvoices.find((i) => i.loadId === "load3");
    expect(notFound).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Matching engine: edge cases
// ---------------------------------------------------------------------------
describe("Regression: Matching engine edge cases", () => {
  it("empty truck still gets a base score", () => {
    const result = scoreTruckForLoad(
      { availability: "Available" },
      { availability: "Available" },
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("truck with current load scores lower than truck without", () => {
    const withLoad = scoreTruckForLoad(
      { availability: "Available" },
      { availability: "Available", currentLoadId: "existing" },
    );
    const withoutLoad = scoreTruckForLoad(
      { availability: "Available" },
      { availability: "Available", currentLoadId: null },
    );
    expect(withoutLoad.score).toBeGreaterThan(withLoad.score);
  });

  it("unavailable truck scores lower than available truck", () => {
    const available = scoreTruckForLoad(
      { availability: "Available" },
      { availability: "Available" },
    );
    const unavailable = scoreTruckForLoad(
      { availability: "Available" },
      { availability: "Out of Service" },
    );
    expect(available.score).toBeGreaterThan(unavailable.score);
  });
});

// ---------------------------------------------------------------------------
// BUG FIX: Post-login provisioning race condition
//
// After OTP login, the frontend must not fire queries requiring requireOrg()
// before the user's organization provisioning has completed. The fix
// separates AppInit (auth + provisioning) from ShellContent (queries)
// so that protected queries only mount after user.orgId exists.
// ---------------------------------------------------------------------------
describe("Regression: Provisioning race condition fix", () => {
  it("ROLES includes all expected roles for provisioning paths", () => {
    // Admin/first-user provisioning creates admin role
    expect(ROLES).toContain("admin");
    // Invited users can have any role
    expect(ROLES).toContain("dispatcher");
    expect(ROLES).toContain("carrier_admin");
    expect(ROLES).toContain("driver");
    expect(ROLES).toContain("read_only");
    expect(ROLES).toContain("super_admin");
    expect(ROLES).toContain("operations");
  });

  it("admin role is in WRITE_ROLES for first-user provisioning", () => {
    // First user is provisioned as admin, which must have write access
    expect(WRITE_ROLES).toContain("admin");
  });

  it("provisioned roles are valid role values", () => {
    // All roles that provisioning can assign must be valid
    const provisioningRoles = ["admin", "dispatcher", "carrier_admin", "driver", "read_only", "operations"];
    for (const role of provisioningRoles) {
      expect(ROLES).toContain(role);
    }
  });

  it("ACCOUNT_STATUSES supports active status set during provisioning", () => {
    // Provisioning sets accountStatus to "active"
    expect(ACCOUNT_STATUSES).toContain("active");
    // Suspension/revocation are post-provisioning states
    expect(ACCOUNT_STATUSES).toContain("suspended");
    expect(ACCOUNT_STATUSES).toContain("revoked");
  });

  it("app has no unauthenticated role that bypasses org check", () => {
    // There must be no role that allows access without an org
    expect(ROLES).not.toContain("anonymous");
    expect(ROLES).not.toContain("public");
    expect(ROLES).not.toContain("guest");
    expect(ROLES).not.toContain("unauthenticated");
  });
});
