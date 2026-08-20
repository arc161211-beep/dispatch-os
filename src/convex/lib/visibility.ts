// ---------------------------------------------------------------------------
// Carrier Financial Visibility enforcement.
//
// SECURITY: This module is the single source of truth for filtering financial
// data before it reaches a carrier_admin or driver user. Every query/mutation
// that returns financial data to a carrier-scoped user MUST go through these
// helpers.
//
// Modes:
//   "full"       — Carrier sees all financial fields (gross, fee, RPM, etc.)
//   "rate_only"  — Carrier sees gross rate + RPM but NOT dispatcher fee/amount
//   "fee_visible" — Carrier sees gross rate AND dispatcher fee (but not carrier amount detail)
//   "none"       — Carrier sees NO financial fields at all
//
// Default (when not configured) is "none" — the most restrictive mode.
// ---------------------------------------------------------------------------

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Role } from "../constants";

export type CarrierFinancialVisibility = "full" | "rate_only" | "fee_visible" | "none";

/**
 * Load the financial visibility mode for the current organization.
 * Falls back to "none" (most restrictive) if not configured.
 */
export async function getFinancialVisibility(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
): Promise<CarrierFinancialVisibility> {
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  return (settings?.carrierFinancialVisibility as CarrierFinancialVisibility) ?? "none";
}

/**
 * Whether the current session requires financial visibility filtering.
 * Only carrier_admin and driver roles are filtered.
 */
export function requiresFinancialFiltering(role: Role): boolean {
  return role === "carrier_admin" || role === "driver";
}

// ---- Financial field lists for different object shapes ----

/** Fields on a load record that contain financial data. */
const LOAD_FINANCIAL_FIELDS_FULL = [
  "grossRateCents",
  "fuelSurchargeCents",
  "accessorialsCents",
  "feeType",
  "feeRatePercent",
  "feeMinCents",
  "feeMaxCents",
  "flatFeeCents",
  "feeCents",
  "carrierAmountCents",
  "rpm",
  "effectiveRpm",
] as const;

const LOAD_FINANCIAL_FIELDS_RATE_ONLY = [
  "feeType",
  "feeRatePercent",
  "feeMinCents",
  "feeMaxCents",
  "flatFeeCents",
  "feeCents",
  "carrierAmountCents",
] as const;

const LOAD_FINANCIAL_FIELDS_FEE_VISIBLE = [
  "carrierAmountCents",
] as const;

/**
 * Filter a load record based on financial visibility.
 * Returns a NEW object with financial fields removed according to the mode.
 * Never mutates the original.
 */
export function filterLoadFinancials<T extends Record<string, unknown>>(
  load: T,
  mode: CarrierFinancialVisibility,
): T {
  if (mode === "full") return load;

  const filtered = { ...load };

  let fieldsToRemove: readonly string[];
  if (mode === "none") {
    fieldsToRemove = LOAD_FINANCIAL_FIELDS_FULL;
  } else if (mode === "rate_only") {
    fieldsToRemove = LOAD_FINANCIAL_FIELDS_RATE_ONLY;
  } else {
    // fee_visible — only remove carrierAmountCents
    fieldsToRemove = LOAD_FINANCIAL_FIELDS_FEE_VISIBLE;
  }

  for (const field of fieldsToRemove) {
    delete filtered[field];
  }

  return filtered;
}

/**
 * Filter an invoice record based on financial visibility.
 * Invoices are financial by nature, but carrier scope still applies.
 * For "none" mode, strip amount/paid fields.
 * For "rate_only" mode, keep amount but remove paid detail.
 */
export function filterInvoiceFinancials<T extends Record<string, unknown>>(
  invoice: T,
  mode: CarrierFinancialVisibility,
): T {
  if (mode === "full") return invoice;

  const filtered = { ...invoice };

  if (mode === "none") {
    delete filtered.amountCents;
    delete filtered.paidCents;
    delete filtered.outstandingCents;
  } else if (mode === "rate_only") {
    // Keep amount for awareness but hide payment detail
    delete filtered.paidCents;
    delete filtered.outstandingCents;
  }
  // "fee_visible" — keep all invoice fields (invoice IS the fee)

  return filtered;
}

/**
 * Filter a report-level financial summary.
 * For carrier_scoped views, this ensures no unintended data leakage.
 */
export function filterReportFinancials<T extends Record<string, unknown>>(
  report: T,
  mode: CarrierFinancialVisibility,
): T {
  if (mode === "full") return report;

  const filtered = { ...report };

  if (mode === "none") {
    delete filtered.grossLoadRevenueCents;
    delete filtered.dispatcherRevenueCents;
    delete filtered.invoicedCents;
    delete filtered.paidCents;
    delete filtered.unpaidCents;
    delete filtered.overdueCents;
    delete filtered.invoiceCount;
    delete filtered.overdueCount;
    delete filtered.invoiceByStatus;
    delete filtered.loadsPerCarrier;
  } else if (mode === "rate_only") {
    delete filtered.dispatcherRevenueCents;
    delete filtered.invoicedCents;
    delete filtered.paidCents;
    delete filtered.unpaidCents;
    delete filtered.overdueCents;
    delete filtered.loadsPerCarrier;
  }
  // "fee_visible" — keep all (dispatcher fee is visible)

  return filtered;
}

/**
 * Sanitize a load for AI tool results exposed to carrier_scoped users.
 * Strips financial fields from the serialized data before sending to the model.
 */
export function filterAiLoadData(
  loadData: Record<string, unknown>,
  mode: CarrierFinancialVisibility,
): Record<string, unknown> {
  return filterLoadFinancials(loadData, mode);
}
