// Money utilities. All stored amounts are integer cents; these helpers only
// format for display or parse user input — the backend remains authoritative.

export function centsToDollars(cents: number | null | undefined): number {
  return Math.round((cents ?? 0)) / 100;
}

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
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

/** Parse a user-entered dollar string ("2,500.50") into integer cents. */
export function dollarsToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const cleaned = String(input).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToDollarsString(cents: number | null | undefined): string {
  return centsToDollars(cents).toFixed(2);
}
