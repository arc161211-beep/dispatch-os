// ---------------------------------------------------------------------------
// Financial math for DispatchOS.
//
// SECURITY / INTEGRITY RULE: all authoritative money values are stored as
// integer cents. Floating point is never used for stored amounts. These
// functions are pure and unit-tested (src/convex/lib/finance.test.ts).
// ---------------------------------------------------------------------------

export interface FeeConfig {
  feeType: "percentage" | "flat";
  feeRatePercent?: number | null;
  feeMinCents?: number | null;
  feeMaxCents?: number | null;
  flatFeeCents?: number | null;
}

export interface FeeBreakdown {
  feeCents: number;
  carrierCents: number;
  method: string;
}

/**
 * Calculate the dispatcher fee and carrier amount for a gross load rate.
 *
 * - percentage:  fee = gross * rate / 100
 * - flat:        fee = flatFeeCents
 * - minimum/maximum bounds apply to the percentage result.
 */
export function calcDispatcherFee(grossCents: number, cfg: FeeConfig | null | undefined): FeeBreakdown {
  if (!cfg || grossCents <= 0) {
    return { feeCents: 0, carrierCents: grossCents, method: "No fee configured" };
  }
  let feeCents: number;
  let method: string;
  if (cfg.feeType === "flat") {
    feeCents = Math.max(0, Math.round(cfg.flatFeeCents ?? 0));
    method = `Flat fee $${(feeCents / 100).toFixed(2)}`;
  } else {
    const rate = cfg.feeRatePercent ?? 0;
    feeCents = Math.round((grossCents * rate) / 100);
    method = `${rate}% of gross`;
    if (cfg.feeMinCents && feeCents < cfg.feeMinCents) {
      feeCents = Math.round(cfg.feeMinCents);
      method = `Minimum fee applied (${rate}% floor)`;
    }
    if (cfg.feeMaxCents && feeCents > cfg.feeMaxCents) {
      feeCents = Math.round(cfg.feeMaxCents);
      method = `Maximum fee applied (${rate}% cap)`;
    }
  }
  const carrierCents = grossCents - feeCents;
  return { feeCents, carrierCents, method };
}

/** Gross rate (dollars) per loaded mile. */
export function calcRpm(grossCents: number, loadedMiles: number | null | undefined): number | null {
  if (!loadedMiles || loadedMiles <= 0) return null;
  return round2(grossCents / 100 / loadedMiles);
}

/** Gross rate (dollars) per loaded + deadhead mile. */
export function calcEffectiveRpm(
  grossCents: number,
  loadedMiles: number | null | undefined,
  deadheadMiles: number | null | undefined,
): number | null {
  const total = (loadedMiles ?? 0) + (deadheadMiles ?? 0);
  if (total <= 0) return null;
  return round2(grossCents / 100 / total);
}

/** Total gross value of a load: rate + fuel surcharge + approved accessorials. */
export function loadTotalCents(load: {
  grossRateCents?: number | null;
  fuelSurchargeCents?: number | null;
  accessorialsCents?: number | null;
}): number {
  return Math.max(0, (load.grossRateCents ?? 0) + (load.fuelSurchargeCents ?? 0) + (load.accessorialsCents ?? 0));
}

/** All derived financial fields for a load, from one authoritative function. */
export function deriveLoadFinance(load: {
  grossRateCents?: number | null;
  fuelSurchargeCents?: number | null;
  accessorialsCents?: number | null;
  loadedMiles?: number | null;
  deadheadMiles?: number | null;
  feeType?: "percentage" | "flat" | null;
  feeRatePercent?: number | null;
  feeMinCents?: number | null;
  feeMaxCents?: number | null;
  flatFeeCents?: number | null;
}) {
  const gross = Math.max(0, load.grossRateCents ?? 0);
  const { feeCents, carrierCents, method } = calcDispatcherFee(gross, {
    feeType: load.feeType ?? "percentage",
    feeRatePercent: load.feeRatePercent ?? null,
    feeMinCents: load.feeMinCents ?? null,
    feeMaxCents: load.feeMaxCents ?? null,
    flatFeeCents: load.flatFeeCents ?? null,
  });
  return {
    grossRateCents: gross,
    fuelSurchargeCents: load.fuelSurchargeCents ?? 0,
    accessorialsCents: load.accessorialsCents ?? 0,
    totalCents: loadTotalCents(load),
    feeCents,
    carrierCents: carrierCents + (load.fuelSurchargeCents ?? 0) + (load.accessorialsCents ?? 0),
    feeMethod: method,
    rpm: calcRpm(gross, load.loadedMiles),
    effectiveRpm: calcEffectiveRpm(gross, load.loadedMiles, load.deadheadMiles),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a user-entered dollar string ("2,500.50") to integer cents. */
export function dollarsToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const cleaned = String(input).replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number | null | undefined): number {
  return round2((cents ?? 0) / 100);
}

export function formatCents(cents: number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(centsToDollars(cents));
}

export function formatRpm(rpm: number | null | undefined): string {
  if (rpm === null || rpm === undefined) return "—";
  return `$${rpm.toFixed(2)}/mi`;
}
