// Lightweight CSV helpers (no external dependency).

export function parseCsv(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return rows;
  const header = splitLine(lines[0]).map((h) => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      if (h) row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const content = [headers.map(escape).join(","), ...rows.map((r) => r.map((c) => escape(c === null || c === undefined ? "" : String(c))).join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvNumber(v: string | undefined): number | undefined {
  const n = Number((v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && v !== undefined && v.trim() !== "" ? n : undefined;
}

export function csvCents(v: string | undefined): number | undefined {
  const n = csvNumber(v);
  return n === undefined ? undefined : Math.round(n * 100);
}

export function csvDate(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}
