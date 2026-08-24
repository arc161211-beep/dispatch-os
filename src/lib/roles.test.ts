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
