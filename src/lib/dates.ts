const DEFAULT_TZ = "America/Chicago";

export function fmtDate(ms: number | null | undefined, tz = DEFAULT_TZ): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }).format(ms);
}

export function fmtDateTime(ms: number | null | undefined, tz = DEFAULT_TZ): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

export function fmtTime(ms: number | null | undefined, tz = DEFAULT_TZ): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(ms);
}

export function fmtRelative(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "—";
  const diff = ms - now;
  const abs = Math.abs(diff);
  const day = 864e5;
  const hour = 36e5;
  if (abs < 60e3) return diff >= 0 ? "now" : "just now";
  if (abs < hour) return diff >= 0 ? `in ${Math.round(abs / 60e3)}m` : `${Math.round(abs / 60e3)}m ago`;
  if (abs < day) return diff >= 0 ? `in ${Math.round(abs / hour)}h` : `${Math.round(abs / hour)}h ago`;
  if (abs < 7 * day) return diff >= 0 ? `in ${Math.round(abs / day)}d` : `${Math.round(abs / day)}d ago`;
  return fmtDate(ms);
}

/** Milliseconds for "today" boundaries in the given timezone. */
export function tzDayStart(dayOffset = 0, tz = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day) + dayOffset);
}

/** Convert an ISO datetime-local input value to epoch ms in the org tz. */
export function datetimeLocalToMs(value: string | null | undefined, tz = DEFAULT_TZ): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return undefined;
  return ms;
}

export function msToDatetimeLocal(ms: number | null | undefined, tz = DEFAULT_TZ): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ms).replace(", ", "T");
}
