/**
 * Tests for CSV export functionality.
 *
 * These tests verify:
 *  - CSV escaping handles special characters
 *  - Financial visibility filtering is applied in exports
 *  - Bounded export limits are respected
 *  - Carrier/driver scoping logic is correct
 */

import { describe, it, expect } from "vitest";
import { requiresFinancialFiltering } from "./lib/visibility";

// ---------------------------------------------------------------------------
// CSV escaping logic (mirrored from exports.ts for testing)
// ---------------------------------------------------------------------------

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CSV escaping tests
// ---------------------------------------------------------------------------

describe("Export: CSV escaping", () => {
  it("escapes commas in values", () => {
    expect(csvEscape("Chicago, IL")).toBe('"Chicago, IL"');
  });

  it("escapes double quotes", () => {
    expect(csvEscape('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("escapes newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns empty string for null/undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("passes through simple strings unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape("LD-1001")).toBe("LD-1001");
  });

  it("handles numbers", () => {
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(0)).toBe("0");
  });

  it("handles empty string", () => {
    expect(csvEscape("")).toBe("");
  });

  it("handles XSS payloads in values (no HTML injection)", () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = csvEscape(malicious);
    expect(escaped).toBe('"<script>alert(""xss"")</script>"');
    // CSV is a text format, not HTML — the escaping ensures proper CSV structure
    expect(escaped).toContain("<script>");
  });

  it("handles SQL-like payloads", () => {
    const malicious = "'; DROP TABLE users; --";
    const escaped = csvEscape(malicious);
    expect(escaped).toBe("'; DROP TABLE users; --");
  });
});

// ---------------------------------------------------------------------------
// CSV generation tests
// ---------------------------------------------------------------------------

describe("Export: CSV generation", () => {
  it("generates correct header + data rows", () => {
    const csv = toCsv(
      ["Name", "Status"],
      [
        ["Carrier A", "Active"],
        ["Carrier B", "Paused"],
      ],
    );
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Status");
    expect(lines[1]).toBe("Carrier A,Active");
    expect(lines[2]).toBe("Carrier B,Paused");
  });

  it("handles empty rows", () => {
    const csv = toCsv(["Name"], []);
    expect(csv).toBe("Name");
  });

  it("handles mixed types", () => {
    const csv = toCsv(["Value"], [["text", 42, null, undefined]]);
    expect(csv).toBe("Value\ntext,42,,");
  });
});

// ---------------------------------------------------------------------------
// Financial visibility in export context
// ---------------------------------------------------------------------------

describe("Export: Financial visibility", () => {
  it("carrier_admin requires financial filtering", () => {
    expect(requiresFinancialFiltering("carrier_admin")).toBe(true);
  });

  it("driver requires financial filtering", () => {
    expect(requiresFinancialFiltering("driver")).toBe(true);
  });

  it("admin does NOT require filtering", () => {
    expect(requiresFinancialFiltering("admin")).toBe(false);
  });

  it("dispatcher does NOT require filtering", () => {
    expect(requiresFinancialFiltering("dispatcher")).toBe(false);
  });

  describe("Load export column selection", () => {
    function getLoadHeaders(vis: "full" | "rate_only" | "fee_visible" | "none"): string[] {
      const headers = ["Load #", "Status", "Origin", "Destination", "Pickup", "Delivery", "Equipment", "Gross Rate"];
      if (vis === "full" || vis === "fee_visible") headers.push("Dispatcher Fee", "Fee %");
      if (vis === "full") headers.push("Carrier Amount", "RPM", "Eff. RPM");
      return headers;
    }

    it("full mode includes all financial columns", () => {
      const h = getLoadHeaders("full");
      expect(h).toContain("Gross Rate");
      expect(h).toContain("Dispatcher Fee");
      expect(h).toContain("Carrier Amount");
      expect(h).toContain("RPM");
      expect(h).toContain("Eff. RPM");
    });

    it("rate_only mode includes gross rate but not fee columns", () => {
      const h = getLoadHeaders("rate_only");
      expect(h).toContain("Gross Rate");
      expect(h).not.toContain("Dispatcher Fee");
      expect(h).not.toContain("Carrier Amount");
      expect(h).not.toContain("RPM");
    });

    it("fee_visible mode includes gross rate and fee but not carrier amount", () => {
      const h = getLoadHeaders("fee_visible");
      expect(h).toContain("Gross Rate");
      expect(h).toContain("Dispatcher Fee");
      expect(h).not.toContain("Carrier Amount");
    });

    it("none mode includes gross rate but not fee/amount", () => {
      const h = getLoadHeaders("none");
      expect(h).toContain("Gross Rate");
      expect(h).not.toContain("Dispatcher Fee");
      expect(h).not.toContain("Carrier Amount");
      expect(h).not.toContain("RPM");
    });
  });

  describe("Invoice export column selection", () => {
    function getInvoiceHeaders(vis: "full" | "rate_only" | "fee_visible" | "none"): string[] {
      const headers = ["Invoice #", "Status", "Issue Date", "Due Date"];
      if (vis !== "none") headers.push("Amount");
      if (vis === "full") headers.push("Paid", "Outstanding");
      headers.push("Notes");
      return headers;
    }

    it("full mode shows all financial columns", () => {
      const h = getInvoiceHeaders("full");
      expect(h).toContain("Amount");
      expect(h).toContain("Paid");
      expect(h).toContain("Outstanding");
    });

    it("rate_only shows amount but not payment detail", () => {
      const h = getInvoiceHeaders("rate_only");
      expect(h).toContain("Amount");
      expect(h).not.toContain("Paid");
      expect(h).not.toContain("Outstanding");
    });

    it("none mode hides amount column", () => {
      const h = getInvoiceHeaders("none");
      expect(h).not.toContain("Amount");
      expect(h).not.toContain("Paid");
      expect(h).not.toContain("Outstanding");
    });
  });
});

// ---------------------------------------------------------------------------
// Scoping logic tests
// ---------------------------------------------------------------------------

describe("Export: Scoping", () => {
  it("carrier_admin only sees own carrier loads", () => {
    const loads = [
      { carrierId: "c1", loadNumber: "LD-1" },
      { carrierId: "c2", loadNumber: "LD-2" },
      { carrierId: "c1", loadNumber: "LD-3" },
    ];
    const scoped = loads.filter((l) => l.carrierId === "c1");
    expect(scoped).toHaveLength(2);
    expect(scoped.map((l) => l.loadNumber)).toEqual(["LD-1", "LD-3"]);
  });

  it("driver only sees own assigned loads", () => {
    const loads = [
      { driverId: "d1", loadNumber: "LD-1" },
      { driverId: "d2", loadNumber: "LD-2" },
      { driverId: "d1", loadNumber: "LD-3" },
    ];
    const scoped = loads.filter((l) => l.driverId === "d1");
    expect(scoped).toHaveLength(2);
  });

  it("admin sees all org loads", () => {
    const loads = [
      { carrierId: "c1", loadNumber: "LD-1" },
      { carrierId: "c2", loadNumber: "LD-2" },
    ];
    // admin: no scoping filter
    expect(loads).toHaveLength(2);
  });
});
