// ---------------------------------------------------------------------------
// DispatchOS domain constants (pure TS — safe to import from schema, libs, and
// tests; never contains secrets).
// ---------------------------------------------------------------------------

export const ROLES = [
  "super_admin",
  "admin",
  "dispatcher",
  "operations",
  "carrier_admin",
  "driver",
  "read_only",
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can create/update operational records (carriers, loads, ...). */
export const ACCOUNT_STATUSES = ["active", "suspended", "revoked", "invited"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const LOCATION_SOURCES = ["driver_mobile", "browser_geolocation", "gps_telematics", "manual", "other"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const CARRIER_FINANCIAL_VISIBILITY = ["full", "rate_only", "fee_visible", "none"] as const;
export type CarrierFinancialVisibility = (typeof CARRIER_FINANCIAL_VISIBILITY)[number];

/** Roles that can create/update operational records (carriers, loads, ...). */
export const WRITE_ROLES: Role[] = ["admin", "dispatcher", "operations"];
/** Roles that can manage users, settings, audit, integrations. */
export const ADMIN_ROLES: Role[] = ["super_admin", "admin"];
/** Roles that can access reports (operations, financial, CRM, dispatcher). */
export const REPORTS_ROLES: Role[] = ["super_admin", "admin", "dispatcher", "operations"];