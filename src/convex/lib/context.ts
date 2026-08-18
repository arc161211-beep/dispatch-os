// ---------------------------------------------------------------------------
// Auth context & authorization helpers.
//
// SECURITY: the organization id is ALWAYS derived from the authenticated
// session — never from the browser. Every query/mutation must go through
// getSession / requireSession and filter by session.orgId.
// ---------------------------------------------------------------------------

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Role } from "../constants";

export interface Session {
  userId: Id<"users">;
  orgId: Id<"organizations">;
  role: Role;
  carrierId?: Id<"carriers">;
  driverId?: Id<"drivers">;
  name?: string;
  email?: string;
  disabled: boolean;
}

export type Ctx = QueryCtx | MutationCtx | ActionCtx;

async function loadSession(ctx: QueryCtx | MutationCtx): Promise<Session | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  if (!user.orgId) return null; // not yet provisioned
  return {
    userId,
    orgId: user.orgId,
    role: (user.role as Role) ?? "read_only",
    carrierId: user.carrierId ?? undefined,
    driverId: user.driverId ?? undefined,
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    disabled: !!user.disabled,
  };
}

/** Returns the session, or null when not signed in / not yet provisioned. */
export async function getSession(ctx: QueryCtx | MutationCtx): Promise<Session | null> {
  return loadSession(ctx);
}

/** Like getSession but throws a friendly error when not signed in. */
export async function requireSignedIn(ctx: QueryCtx | MutationCtx): Promise<Session> {
  const s = await loadSession(ctx);
  if (!s) throw new ConvexError("You must be signed in to do that.");
  return s;
}

/** Requires a signed-in user with a provisioned organization. */
export async function requireOrg(ctx: QueryCtx | MutationCtx): Promise<Session> {
  const s = await loadSession(ctx);
  if (!s) throw new ConvexError("Your workspace is still being set up. Please refresh.");
  if (s.disabled) throw new ConvexError("This account has been disabled. Contact your administrator.");
  return s;
}

export function isWriteRole(role: Role): boolean {
  return role === "admin" || role === "dispatcher" || role === "operations";
}

export function isAdminRole(role: Role): boolean {
  return role === "super_admin" || role === "admin";
}

/** Requires an operational write role (admin, dispatcher, operations). */
export async function requireWrite(ctx: QueryCtx | MutationCtx): Promise<Session> {
  const s = await requireOrg(ctx);
  if (!isWriteRole(s.role)) {
    throw new ConvexError("You do not have permission to modify records in this workspace.");
  }
  return s;
}

/** Requires an administrative role (super_admin, admin). */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Session> {
  const s = await requireOrg(ctx);
  if (!isAdminRole(s.role)) {
    throw new ConvexError("Administrator permission required.");
  }
  return s;
}

export async function requireRole(ctx: QueryCtx | MutationCtx, roles: Role[]): Promise<Session> {
  const s = await requireOrg(ctx);
  if (!roles.includes(s.role)) {
    throw new ConvexError("You do not have permission to perform this action.");
  }
  return s;
}

/**
 * Tenant + role visibility filter used by list queries.
 * - super_admin/admin/dispatcher/operations/read_only: whole organization
 * - carrier_admin: only the carrier they are linked to
 * - driver: only their own assigned driver record's carrier scope
 */
export function orgFilter(s: Session): { orgId: Id<"organizations">; carrierId?: Id<"carriers"> } {
  const f: { orgId: Id<"organizations">; carrierId?: Id<"carriers"> } = { orgId: s.orgId };
  if (s.role === "carrier_admin" && s.carrierId) f.carrierId = s.carrierId;
  return f;
}

/** Load-scoped filter: driver role only sees loads assigned to their driverId. */
export function loadScope(s: Session): {
  orgId: Id<"organizations">;
  carrierId?: Id<"carriers">;
  driverId?: Id<"drivers">;
} {
  const f: { orgId: Id<"organizations">; carrierId?: Id<"carriers">; driverId?: Id<"drivers"> } = { orgId: s.orgId };
  if (s.role === "carrier_admin" && s.carrierId) f.carrierId = s.carrierId;
  if (s.role === "driver" && s.driverId) f.driverId = s.driverId;
  return f;
}
