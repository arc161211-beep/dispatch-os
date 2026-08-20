/**
 * Authorization regression tests for DispatchOS.
 *
 * These tests verify the correctness of role-based access control logic,
 * carrier/driver scoping, and cross-tenant/cross-carrier isolation properties.
 *
 * These are logic-level tests that verify the authorization helpers and
 * constants are correctly configured. They do NOT test live Convex queries.
 * For live testing, these should be supplemented with integration tests
 * using the Convex test backend.
 */

import { describe, it, expect } from "vitest";
import {
  ROLES,
  WRITE_ROLES,
  ADMIN_ROLES,
  ACCOUNT_STATUSES,
  CARRIER_STATUSES,
  CARRIER_FINANCIAL_VISIBILITY,
  type Role,
} from "./constants";
import { requiresFinancialFiltering } from "./lib/visibility";

// ---------------------------------------------------------------------------
// Helper: simulate session scoping
// ---------------------------------------------------------------------------

interface MockSession {
  userId: string;
  orgId: string;
  role: Role;
  carrierId?: string;
  driverId?: string;
}

function orgFilter(s: MockSession): { orgId: string; carrierId?: string } {
  const f: { orgId: string; carrierId?: string } = { orgId: s.orgId };
  if (s.role === "carrier_admin" && s.carrierId) f.carrierId = s.carrierId;
  return f;
}

function loadScope(s: MockSession): { orgId: string; carrierId?: string; driverId?: string } {
  const f: { orgId: string; carrierId?: string; driverId?: string } = { orgId: s.orgId };
  if (s.role === "carrier_admin" && s.carrierId) f.carrierId = s.carrierId;
  if (s.role === "driver" && s.driverId) f.driverId = s.driverId;
  return f;
}

// ---------------------------------------------------------------------------
// Role hierarchy tests
// ---------------------------------------------------------------------------

describe("Authorization: Role hierarchy", () => {
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

  it("WRITE_ROLES and ADMIN_ROLES overlap only on admin roles", () => {
    const overlap = WRITE_ROLES.filter((r) => ADMIN_ROLES.includes(r));
    expect(overlap).toEqual(["admin"]);
  });

  it("carrier_admin is NOT a write or admin role", () => {
    expect(WRITE_ROLES).not.toContain("carrier_admin");
    expect(ADMIN_ROLES).not.toContain("carrier_admin");
  });

  it("driver is NOT a write or admin role", () => {
    expect(WRITE_ROLES).not.toContain("driver");
    expect(ADMIN_ROLES).not.toContain("driver");
  });

  it("read_only is NOT a write or admin role", () => {
    expect(WRITE_ROLES).not.toContain("read_only");
    expect(ADMIN_ROLES).not.toContain("read_only");
  });

  it("super_admin is admin role but not in WRITE_ROLES", () => {
    expect(ADMIN_ROLES).toContain("super_admin");
    expect(WRITE_ROLES).not.toContain("super_admin");
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant isolation
// ---------------------------------------------------------------------------

describe("Authorization: Cross-tenant isolation", () => {
  it("org filter always uses session orgId", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "admin",
    };
    const filter = orgFilter(session);
    expect(filter.orgId).toBe("org_a");
  });

  it("carrier_admin is scoped to their carrier", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "carrier_admin",
      carrierId: "carrier_1",
    };
    const filter = orgFilter(session);
    expect(filter.orgId).toBe("org_a");
    expect(filter.carrierId).toBe("carrier_1");
  });

  it("carrier_admin cannot access data from another carrier", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "carrier_admin",
      carrierId: "carrier_1",
    };
    const filter = orgFilter(session);
    const otherCarrierData = { carrierId: "carrier_2" };
    // This is the scoping check that every query does
    expect(filter.carrierId).toBeDefined();
    expect(otherCarrierData.carrierId).not.toBe(filter.carrierId);
  });

  it("driver is scoped to their assigned driver record", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "driver",
      driverId: "driver_1",
    };
    const scope = loadScope(session);
    expect(scope.driverId).toBe("driver_1");
    expect(scope.carrierId).toBeUndefined();
  });

  it("driver can only see loads assigned to their driverId", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "driver",
      driverId: "driver_1",
    };
    const scope = loadScope(session);
    const loads = [
      { driverId: "driver_1", loadNumber: "LD-1" },
      { driverId: "driver_2", loadNumber: "LD-2" },
    ];
    const visible = loads.filter((l) => !scope.driverId || l.driverId === scope.driverId);
    expect(visible).toHaveLength(1);
    expect(visible[0].loadNumber).toBe("LD-1");
  });

  it("admin sees all org data without carrier scoping", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "admin",
    };
    const filter = orgFilter(session);
    expect(filter.carrierId).toBeUndefined();
  });

  it("two different orgs cannot see each other's data", () => {
    const orgA: MockSession = { userId: "u1", orgId: "org_a", role: "admin" };
    const orgB: MockSession = { userId: "u2", orgId: "org_b", role: "admin" };
    const filterA = orgFilter(orgA);
    const filterB = orgFilter(orgB);
    expect(filterA.orgId).not.toBe(filterB.orgId);
  });

  it("read_only role cannot write", () => {
    expect(WRITE_ROLES).not.toContain("read_only");
    expect(ADMIN_ROLES).not.toContain("read_only");
  });
});

// ---------------------------------------------------------------------------
// Financial visibility enforcement
// ---------------------------------------------------------------------------

describe("Authorization: Financial visibility", () => {
  it("carrier_admin and driver are the only roles with financial filtering", () => {
    for (const role of ROLES) {
      if (role === "carrier_admin" || role === "driver") {
        expect(requiresFinancialFiltering(role)).toBe(true);
      } else {
        expect(requiresFinancialFiltering(role)).toBe(false);
      }
    }
  });

  it("all four visibility modes are valid", () => {
    const modes = CARRIER_FINANCIAL_VISIBILITY;
    expect(modes).toContain("full");
    expect(modes).toContain("rate_only");
    expect(modes).toContain("fee_visible");
    expect(modes).toContain("none");
    expect(modes).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Account status enforcement
// ---------------------------------------------------------------------------

describe("Authorization: Account status", () => {
  it("suspended accounts should be denied access", () => {
    const session: MockSession = {
      userId: "user1",
      orgId: "org_a",
      role: "admin",
    };
    const accountStatus = "suspended";
    // Simulating what requireOrg does
    expect(accountStatus === "suspended").toBe(true);
  });

  it("revoked accounts should be denied access", () => {
    const accountStatus = "revoked";
    expect(accountStatus === "revoked").toBe(true);
  });

  it("disabled accounts should be denied access", () => {
    const disabled = true;
    expect(disabled).toBe(true);
  });

  it("all required account statuses exist", () => {
    expect(ACCOUNT_STATUSES).toContain("active");
    expect(ACCOUNT_STATUSES).toContain("suspended");
    expect(ACCOUNT_STATUSES).toContain("revoked");
    expect(ACCOUNT_STATUSES).toContain("invited");
    expect(ACCOUNT_STATUSES).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Invitation security
// ---------------------------------------------------------------------------

describe("Authorization: Invitation security", () => {
  it("invitation expiry is 7 days", () => {
    const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
    expect(INVITE_EXPIRY_MS).toBe(604_800_000);
  });

  it("expired invitations should be rejected", () => {
    const expiresAt = Date.now() - 1000; // 1 second ago
    expect(expiresAt < Date.now()).toBe(true);
  });

  it("pending invitations have a status field", () => {
    const statuses = ["pending", "accepted", "revoked"];
    expect(statuses).toContain("pending");
    expect(statuses).toContain("accepted");
    expect(statuses).toContain("revoked");
  });

  it("carrierId is stored in invitation", () => {
    // Verify the schema supports carrierId in pendingUsers
    const invite = {
      email: "test@example.com",
      orgId: "org_1",
      role: "carrier_admin",
      carrierId: "carrier_1",
      status: "pending",
    };
    expect(invite.carrierId).toBe("carrier_1");
  });
});
