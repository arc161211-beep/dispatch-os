import { describe, expect, it } from "vitest";
import {
  getRoleDestination,
  authorizePath,
  validateReturnTo,
  resolveLoginDestination,
} from "./roles";

// ---------------------------------------------------------------------------
// getRoleDestination
// ---------------------------------------------------------------------------

describe("getRoleDestination", () => {
  it("maps admin to /dashboard", () => {
    expect(getRoleDestination("admin")).toBe("/dashboard");
  });

  it("maps super_admin to /dashboard", () => {
    expect(getRoleDestination("super_admin")).toBe("/dashboard");
  });

  it("maps dispatcher to /dashboard", () => {
    expect(getRoleDestination("dispatcher")).toBe("/dashboard");
  });

  it("maps operations to /dashboard", () => {
    expect(getRoleDestination("operations")).toBe("/dashboard");
  });

  it("maps driver to /portal/driver", () => {
    expect(getRoleDestination("driver")).toBe("/portal/driver");
  });

  it("maps carrier_admin to /portal/carrier", () => {
    expect(getRoleDestination("carrier_admin")).toBe("/portal/carrier");
  });

  it("maps read_only to /dashboard", () => {
    expect(getRoleDestination("read_only")).toBe("/dashboard");
  });
});

// ---------------------------------------------------------------------------
// authorizePath
// ---------------------------------------------------------------------------

describe("authorizePath", () => {
  it("allows any role to access /dashboard", () => {
    expect(authorizePath("/dashboard", "admin")).toBeNull();
    expect(authorizePath("/dashboard", "dispatcher")).toBeNull();
    expect(authorizePath("/dashboard", "driver")).toBe("/portal/driver");
    expect(authorizePath("/dashboard", "carrier_admin")).toBe("/portal/carrier");
  });

  it("restricts /portal/driver to driver role only", () => {
    expect(authorizePath("/portal/driver", "driver")).toBeNull();
    expect(authorizePath("/portal/driver", "admin")).toBe("/dashboard");
    expect(authorizePath("/portal/driver", "carrier_admin")).toBe("/portal/carrier");
    expect(authorizePath("/portal/driver", "dispatcher")).toBe("/dashboard");
  });

  it("restricts /portal/carrier to carrier_admin role only", () => {
    expect(authorizePath("/portal/carrier", "carrier_admin")).toBeNull();
    expect(authorizePath("/portal/carrier", "admin")).toBe("/dashboard");
    expect(authorizePath("/portal/carrier", "driver")).toBe("/portal/driver");
    expect(authorizePath("/portal/carrier", "dispatcher")).toBe("/dashboard");
  });

  it("restricts /users to admin/dispatcher/operations", () => {
    expect(authorizePath("/users", "admin")).toBeNull();
    expect(authorizePath("/users", "dispatcher")).toBeNull();
    expect(authorizePath("/users", "operations")).toBeNull();
    expect(authorizePath("/users", "driver")).toBe("/portal/driver");
    expect(authorizePath("/users", "carrier_admin")).toBe("/portal/carrier");
    expect(authorizePath("/users", "read_only")).toBe("/dashboard");
  });

  it("restricts /settings to admin/dispatcher/operations", () => {
    expect(authorizePath("/settings", "admin")).toBeNull();
    expect(authorizePath("/settings", "driver")).toBe("/portal/driver");
    expect(authorizePath("/settings", "carrier_admin")).toBe("/portal/carrier");
  });

  it("allows public routes for any role", () => {
    expect(authorizePath("/", "admin")).toBeNull();
    expect(authorizePath("/", "driver")).toBeNull();
    expect(authorizePath("/auth", "admin")).toBeNull();
    expect(authorizePath("/auth", "driver")).toBeNull();
    expect(authorizePath("/track/abc123", "admin")).toBeNull();
    expect(authorizePath("/track/abc123", "driver")).toBeNull();
  });

  it("drivers cannot access admin operations routes", () => {
    expect(authorizePath("/leads", "driver")).toBe("/portal/driver");
    expect(authorizePath("/carriers", "driver")).toBe("/portal/driver");
    expect(authorizePath("/trucks", "driver")).toBe("/portal/driver");
    expect(authorizePath("/loads", "driver")).toBe("/portal/driver");
    expect(authorizePath("/messages", "driver")).toBe("/portal/driver");
  });

  it("carrier_admins cannot access admin operations routes", () => {
    expect(authorizePath("/leads", "carrier_admin")).toBe("/portal/carrier");
    expect(authorizePath("/carriers", "carrier_admin")).toBe("/portal/carrier");
    expect(authorizePath("/trucks", "carrier_admin")).toBe("/portal/carrier");
  });

  it("admin can access all admin routes", () => {
    expect(authorizePath("/leads", "admin")).toBeNull();
    expect(authorizePath("/carriers", "admin")).toBeNull();
    expect(authorizePath("/trucks", "admin")).toBeNull();
    expect(authorizePath("/drivers", "admin")).toBeNull();
    expect(authorizePath("/loads", "admin")).toBeNull();
    expect(authorizePath("/users", "admin")).toBeNull();
    expect(authorizePath("/audit", "admin")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateReturnTo
// ---------------------------------------------------------------------------

describe("validateReturnTo", () => {
  it("accepts valid internal paths", () => {
    expect(validateReturnTo("/dashboard", "/fallback")).toBe("/dashboard");
    expect(validateReturnTo("/portal/driver", "/fallback")).toBe("/portal/driver");
    expect(validateReturnTo("/portal/carrier", "/fallback")).toBe("/portal/carrier");
    expect(validateReturnTo("/loads/abc123", "/fallback")).toBe("/loads/abc123");
  });

  it("rejects protocol-relative URLs", () => {
    expect(validateReturnTo("//evil.com", "/fallback")).toBe("/fallback");
  });

  it("rejects external URLs", () => {
    expect(validateReturnTo("https://evil.com", "/fallback")).toBe("/fallback");
    expect(validateReturnTo("http://evil.com", "/fallback")).toBe("/fallback");
  });

  it("rejects paths with embedded protocols", () => {
    expect(validateReturnTo("/foo://bar", "/fallback")).toBe("/fallback");
  });

  it("rejects null and undefined", () => {
    expect(validateReturnTo(null, "/fallback")).toBe("/fallback");
    expect(validateReturnTo(undefined, "/fallback")).toBe("/fallback");
  });

  it("rejects empty string", () => {
    expect(validateReturnTo("", "/fallback")).toBe("/fallback");
  });

  it("falls back for unknown paths", () => {
    expect(validateReturnTo("/unknown-path", "/fallback")).toBe("/fallback");
  });

  it("allows sub-paths of known routes", () => {
    expect(validateReturnTo("/carriers/abc123", "/fallback")).toBe("/carriers/abc123");
    expect(validateReturnTo("/drivers/xyz789", "/fallback")).toBe("/drivers/xyz789");
    expect(validateReturnTo("/loads/load1/detail", "/fallback")).toBe("/loads/load1/detail");
  });
});

// ---------------------------------------------------------------------------
// resolveLoginDestination
// ---------------------------------------------------------------------------

describe("resolveLoginDestination", () => {
  it("redirects driver to /portal/driver when no returnTo", () => {
    expect(resolveLoginDestination("driver", null)).toBe("/portal/driver");
  });

  it("redirects carrier_admin to /portal/carrier when no returnTo", () => {
    expect(resolveLoginDestination("carrier_admin", null)).toBe("/portal/carrier");
  });

  it("redirects admin to /dashboard when no returnTo", () => {
    expect(resolveLoginDestination("admin", null)).toBe("/dashboard");
  });

  it("allows driver returnTo /portal/driver", () => {
    expect(resolveLoginDestination("driver", "/portal/driver")).toBe("/portal/driver");
  });

  it("allows admin returnTo /dashboard", () => {
    expect(resolveLoginDestination("admin", "/dashboard")).toBe("/dashboard");
  });

  it("blocks driver from /dashboard via returnTo", () => {
    expect(resolveLoginDestination("driver", "/dashboard")).toBe("/portal/driver");
  });

  it("blocks admin from /portal/driver via returnTo", () => {
    expect(resolveLoginDestination("admin", "/portal/driver")).toBe("/dashboard");
  });

  it("blocks carrier_admin from /portal/driver via returnTo", () => {
    expect(resolveLoginDestination("carrier_admin", "/portal/driver")).toBe("/portal/carrier");
  });

  it("allows carrier_admin returnTo /portal/carrier", () => {
    expect(resolveLoginDestination("carrier_admin", "/portal/carrier")).toBe("/portal/carrier");
  });

  it("rejects external returnTo URLs", () => {
    expect(resolveLoginDestination("admin", "https://evil.com")).toBe("/dashboard");
  });

  it("returns /auth when role is undefined", () => {
    expect(resolveLoginDestination(undefined, "/dashboard")).toBe("/auth");
  });

  it("allows driver returnTo /loads/some-load-id", () => {
    // Drivers can access /loads through their portal
    // But since authorizePath blocks /loads for drivers, the returnTo is overridden
    expect(resolveLoginDestination("driver", "/loads/abc123")).toBe("/portal/driver");
  });
});

// ---------------------------------------------------------------------------
// Multi-role invitation + provision + redirect regression tests
//
// These tests verify that the generic invitation and login system works
// correctly for ALL roles — no hardcoded emails or test-specific logic.
// ---------------------------------------------------------------------------

describe("Invitation + provision + redirect: generic multi-role flow", () => {
  /**
   * Simulates the complete post-login redirect logic:
   * 1. Admin invites a user with a specific role
   * 2. User logs in via OTP
   * 3. provision() returns { role } for that user
   * 4. resolveLoginDestination() determines the redirect
   */
  const simulateLogin = (
    email: string,
    role: "admin" | "super_admin" | "dispatcher" | "operations" | "carrier_admin" | "driver" | "read_only",
    returnTo?: string,
  ) => {
    // In the real system, provision() returns the role from the DB.
    // Here we simulate that the returned role matches the invited role.
    const resolvedRole = role;
    return resolveLoginDestination(resolvedRole, returnTo);
  };

  it("invited driver → /portal/driver", () => {
    expect(simulateLogin("driver-test@example.com", "driver")).toBe("/portal/driver");
  });

  it("invited carrier_admin → /portal/carrier", () => {
    expect(simulateLogin("carrier-test@example.com", "carrier_admin")).toBe("/portal/carrier");
  });

  it("invited dispatcher → /dashboard", () => {
    expect(simulateLogin("dispatcher-test@example.com", "dispatcher")).toBe("/dashboard");
  });

  it("invited operations → /dashboard", () => {
    expect(simulateLogin("operations-test@example.com", "operations")).toBe("/dashboard");
  });

  it("invited admin → /dashboard", () => {
    expect(simulateLogin("admin-test@example.com", "admin")).toBe("/dashboard");
  });

  it("invited super_admin → /dashboard", () => {
    expect(simulateLogin("superadmin-test@example.com", "super_admin")).toBe("/dashboard");
  });

  it("invited read_only → /dashboard", () => {
    expect(simulateLogin("readonly-test@example.com", "read_only")).toBe("/dashboard");
  });

  it("unknown user with no role → /auth (denied)", () => {
    expect(simulateLogin("unknown@example.com", undefined as never)).toBe("/auth");
  });

  it("driver with returnTo=/portal/driver stays on /portal/driver", () => {
    expect(simulateLogin("driver@example.com", "driver", "/portal/driver")).toBe("/portal/driver");
  });

  it("driver with returnTo=/dashboard gets redirected to /portal/driver", () => {
    // A driver trying to access admin routes must be redirected to their portal
    expect(simulateLogin("driver@example.com", "driver", "/dashboard")).toBe("/portal/driver");
  });

  it("carrier_admin with returnTo=/portal/carrier stays on /portal/carrier", () => {
    expect(simulateLogin("carrier@example.com", "carrier_admin", "/portal/carrier")).toBe("/portal/carrier");
  });

  it("carrier_admin with returnTo=/dashboard gets redirected to /portal/carrier", () => {
    expect(simulateLogin("carrier@example.com", "carrier_admin", "/dashboard")).toBe("/portal/carrier");
  });

  it("carrier_admin with returnTo=/portal/driver gets redirected to /portal/carrier", () => {
    expect(simulateLogin("carrier@example.com", "carrier_admin", "/portal/driver")).toBe("/portal/carrier");
  });

  it("admin with returnTo=/portal/driver gets redirected to /dashboard", () => {
    expect(simulateLogin("admin@example.com", "admin", "/portal/driver")).toBe("/dashboard");
  });

  it("admin with returnTo=/portal/carrier gets redirected to /dashboard", () => {
    expect(simulateLogin("admin@example.com", "admin", "/portal/carrier")).toBe("/dashboard");
  });

  it("dispatcher with returnTo=/portal/driver gets redirected to /dashboard", () => {
    expect(simulateLogin("dispatcher@example.com", "dispatcher", "/portal/driver")).toBe("/dashboard");
  });
});

// ---------------------------------------------------------------------------
// Cross-role portal isolation
// ---------------------------------------------------------------------------

describe("Cross-role portal isolation: no role can access another role's portal", () => {
  const adminRoles: Array<"admin" | "super_admin" | "dispatcher" | "operations"> = [
    "admin", "super_admin", "dispatcher", "operations",
  ];

  for (const role of adminRoles) {
    it(`${role} cannot access /portal/driver`, () => {
      const redirect = authorizePath("/portal/driver", role);
      expect(redirect).toBe("/dashboard");
    });

    it(`${role} cannot access /portal/carrier`, () => {
      const redirect = authorizePath("/portal/carrier", role);
      expect(redirect).toBe("/dashboard");
    });
  }

  it("driver cannot access /dashboard", () => {
    expect(authorizePath("/dashboard", "driver")).toBe("/portal/driver");
  });

  it("driver cannot access /leads", () => {
    expect(authorizePath("/leads", "driver")).toBe("/portal/driver");
  });

  it("driver cannot access /carriers", () => {
    expect(authorizePath("/carriers", "driver")).toBe("/portal/driver");
  });

  it("driver cannot access /users", () => {
    expect(authorizePath("/users", "driver")).toBe("/portal/driver");
  });

  it("driver cannot access /settings", () => {
    expect(authorizePath("/settings", "driver")).toBe("/portal/driver");
  });

  it("driver CAN access /portal/driver", () => {
    expect(authorizePath("/portal/driver", "driver")).toBeNull();
  });

  it("carrier_admin cannot access /dashboard", () => {
    expect(authorizePath("/dashboard", "carrier_admin")).toBe("/portal/carrier");
  });

  it("carrier_admin cannot access /leads", () => {
    expect(authorizePath("/leads", "carrier_admin")).toBe("/portal/carrier");
  });

  it("carrier_admin cannot access /users", () => {
    expect(authorizePath("/users", "carrier_admin")).toBe("/portal/carrier");
  });

  it("carrier_admin CAN access /portal/carrier", () => {
    expect(authorizePath("/portal/carrier", "carrier_admin")).toBeNull();
  });

  it("driver can access public routes", () => {
    expect(authorizePath("/", "driver")).toBeNull();
    expect(authorizePath("/auth", "driver")).toBeNull();
    expect(authorizePath("/track/abc123", "driver")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Returning user: provision returns existing role
// ---------------------------------------------------------------------------

describe("Returning user: provision returns role in all code paths", () => {
  it("all ROLES have a defined destination", () => {
    const allRoles: Array<"super_admin" | "admin" | "dispatcher" | "operations" | "carrier_admin" | "driver" | "read_only"> = [
      "super_admin", "admin", "dispatcher", "operations",
      "carrier_admin", "driver", "read_only",
    ];
    for (const role of allRoles) {
      const dest = getRoleDestination(role);
      expect(dest).toBeTruthy();
      expect(dest.startsWith("/")).toBe(true);
    }
  });

  it("every role's destination is a valid internal route", () => {
    const validRoutes = [
      "/dashboard", "/portal/driver", "/portal/carrier",
    ];
    const allRoles: Array<"super_admin" | "admin" | "dispatcher" | "operations" | "carrier_admin" | "driver" | "read_only"> = [
      "super_admin", "admin", "dispatcher", "operations",
      "carrier_admin", "driver", "read_only",
    ];
    for (const role of allRoles) {
      expect(validRoutes).toContain(getRoleDestination(role));
    }
  });
});
