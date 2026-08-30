import type { Role } from "@/convex/constants";

// ---------------------------------------------------------------------------
// Role → Default destination mapping
// ---------------------------------------------------------------------------

const ROLE_DESTINATION: Record<Role, string> = {
  super_admin: "/dashboard",
  admin: "/dashboard",
  dispatcher: "/dashboard",
  operations: "/dashboard",
  carrier_admin: "/portal/carrier",
  driver: "/portal/driver",
  read_only: "/dashboard",
};

/** Returns the canonical destination for a given role. */
export function getRoleDestination(role: Role): string {
  return ROLE_DESTINATION[role] ?? "/dashboard";
}

// ---------------------------------------------------------------------------
// Route authorization — which roles may access which paths
// ---------------------------------------------------------------------------

/** Admin-only routes that require write/admin roles. */
const ADMIN_ROUTES = [
  "/users",
  "/integrations",
  "/settings",
  "/audit",
  "/status",
];

/** Carrier portal routes. */
const CARRIER_ROUTES = ["/portal/carrier"];

/** Driver portal routes. */
const DRIVER_ROUTES = ["/portal/driver"];

/**
 * Determines the canonical destination for a given path based on the user's
 * actual role. Returns `null` when the path is a public route (landing,
 * auth, tracking) that any authenticated user may visit.
 *
 * If the user is NOT authorized for the requested path, returns the
 * user's correct default destination instead.
 */
export function authorizePath(pathname: string, role: Role): string | null {
  // Public routes — any authenticated user may access
  if (
    pathname === "/" ||
    pathname === "/auth" ||
    pathname.startsWith("/track/")
  ) {
    return null; // no restriction
  }

  // Driver portal — driver only
  if (DRIVER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    if (role !== "driver") return getRoleDestination(role);
    return null; // authorized
  }

  // Carrier portal — carrier_admin only
  if (CARRIER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    if (role !== "carrier_admin") return getRoleDestination(role);
    return null; // authorized
  }

  // Admin routes that need admin/write role
  if (ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    if (role === "driver" || role === "carrier_admin" || role === "read_only") {
      return getRoleDestination(role);
    }
    return null; // authorized
  }

  // All other /dashboard, /leads, /carriers, etc. — admin/dispatcher/operations
  // Drivers and carrier admins should not access the main admin app
  if (role === "driver" || role === "carrier_admin") {
    return getRoleDestination(role);
  }

  return null; // authorized
}

// ---------------------------------------------------------------------------
// returnTo validation
// ---------------------------------------------------------------------------

/** Set of paths that are safe for redirect after authentication. */
const SAFE_INTERNAL_PATHS = [
  "/dashboard",
  "/leads",
  "/carriers",
  "/trucks",
  "/truck-map",
  "/drivers",
  "/loads",
  "/brokers",
  "/shippers",
  "/messages",
  "/documents",
  "/tasks",
  "/calendar",
  "/finance",
  "/reports",
  "/assistant",
  "/notifications",
  "/integrations",
  "/settings",
  "/users",
  "/audit",
  "/status",
  "/portal/driver",
  "/portal/carrier",
];

/**
 * Validates a returnTo path. Only allows internal paths that start with "/"
 * and are not protocol-relative ("//"). Also checks against the safe list
 * for sub-paths (e.g., /loads/:id).
 *
 * Returns the validated path, or the fallback if invalid.
 */
export function validateReturnTo(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  if (!returnTo) return fallback;

  // Must start with / and not be protocol-relative
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return fallback;

  // Must not contain query strings with external URLs
  if (returnTo.includes("://")) return fallback;

  // Check exact match or sub-path match against safe routes
  const isSafe = SAFE_INTERNAL_PATHS.some(
    (safe) => returnTo === safe || returnTo.startsWith(safe + "/"),
  );

  return isSafe ? returnTo : fallback;
}

/**
 * After login, given a user's role and optional returnTo, determine the
 * correct destination. Validates returnTo against role permissions.
 */
export function resolveLoginDestination(
  role: Role | undefined,
  returnTo: string | null | undefined,
): string {
  if (!role) return "/auth";

  const validatedReturn = validateReturnTo(returnTo, "");
  if (validatedReturn) {
    // Check if the role is authorized for this path
    const authResult = authorizePath(validatedReturn, role);
    if (authResult === null) {
      // Role is authorized for this path
      return validatedReturn;
    }
    // Role is NOT authorized — redirect to their default
    return authResult;
  }

  return getRoleDestination(role);
}
