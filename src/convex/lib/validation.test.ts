/**
 * Unit tests for validation helpers.
 *
 * Covers:
 *  - reqString (required, trim, max length)
 *  - optString (optional, trim, max length)
 *  - validEmail (format validation)
 *  - positiveNumber (non-negative validation)
 *  - parseTags (string/array/null input)
 *  - safeDate (valid timestamp validation)
 */

import { describe, it, expect } from "vitest";
import { reqString, optString, validEmail, positiveNumber, parseTags, safeDate } from "./validation";

// ---------------------------------------------------------------------------
// reqString
// ---------------------------------------------------------------------------
describe("reqString", () => {
  it("returns trimmed string", () => {
    expect(reqString("  hello  ", "Name")).toBe("hello");
  });

  it("throws on empty string", () => {
    expect(() => reqString("", "Name")).toThrow("Name is required");
  });

  it("throws on null", () => {
    expect(() => reqString(null as any, "Name")).toThrow("Name is required");
  });

  it("throws on whitespace-only string", () => {
    expect(() => reqString("   ", "Name")).toThrow("Name is required");
  });

  it("throws when too long", () => {
    expect(() => reqString("a".repeat(501), "Name")).toThrow("too long");
  });

  it("respects custom max length", () => {
    expect(() => reqString("a".repeat(11), "Name", 10)).toThrow("too long");
  });
});

// ---------------------------------------------------------------------------
// optString
// ---------------------------------------------------------------------------
describe("optString", () => {
  it("returns trimmed string", () => {
    expect(optString("  hello  ")).toBe("hello");
  });

  it("returns undefined for empty string", () => {
    expect(optString("")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(optString(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(optString(undefined)).toBeUndefined();
  });

  it("throws when too long", () => {
    expect(() => optString("a".repeat(1001))).toThrow("too long");
  });
});

// ---------------------------------------------------------------------------
// validEmail
// ---------------------------------------------------------------------------
describe("validEmail", () => {
  it("returns valid email", () => {
    expect(validEmail("test@example.com")).toBe("test@example.com");
  });

  it("returns undefined for null", () => {
    expect(validEmail(null)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(validEmail("")).toBeUndefined();
  });

  it("throws for invalid email without @", () => {
    expect(() => validEmail("testexample.com")).toThrow("valid email");
  });

  it("throws for invalid email without domain", () => {
    expect(() => validEmail("test@")).toThrow("valid email");
  });

  it("throws for email with spaces", () => {
    expect(() => validEmail("test @example.com")).toThrow("valid email");
  });

  it("trims whitespace", () => {
    expect(validEmail("  test@example.com  ")).toBe("test@example.com");
  });
});

// ---------------------------------------------------------------------------
// positiveNumber
// ---------------------------------------------------------------------------
describe("positiveNumber", () => {
  it("returns positive number", () => {
    expect(positiveNumber(50, "Weight")).toBe(50);
  });

  it("returns undefined for null", () => {
    expect(positiveNumber(null, "Weight")).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(positiveNumber(undefined, "Weight")).toBeUndefined();
  });

  it("allows zero", () => {
    expect(positiveNumber(0, "Weight")).toBe(0);
  });

  it("throws for negative number", () => {
    expect(() => positiveNumber(-5, "Weight")).toThrow("positive number");
  });

  it("throws for NaN", () => {
    expect(() => positiveNumber(NaN, "Weight")).toThrow("positive number");
  });

  it("throws for Infinity", () => {
    expect(() => positiveNumber(Infinity, "Weight")).toThrow("positive number");
  });
});

// ---------------------------------------------------------------------------
// parseTags
// ---------------------------------------------------------------------------
describe("parseTags", () => {
  it("parses comma-separated string", () => {
    expect(parseTags("tag1, tag2, tag3")).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("parses array of strings", () => {
    expect(parseTags(["tag1", "tag2"])).toEqual(["tag1", "tag2"]);
  });

  it("returns empty array for null", () => {
    expect(parseTags(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(parseTags(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("trims whitespace", () => {
    expect(parseTags("  tag1 , tag2  ")).toEqual(["tag1", "tag2"]);
  });

  it("filters empty entries", () => {
    expect(parseTags("tag1,,tag2,")).toEqual(["tag1", "tag2"]);
  });

  it("limits to 20 tags", () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    expect(parseTags(tags)).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// safeDate
// ---------------------------------------------------------------------------
describe("safeDate", () => {
  it("returns valid timestamp", () => {
    const now = Date.now();
    expect(safeDate(now)).toBe(now);
  });

  it("returns undefined for null", () => {
    expect(safeDate(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(safeDate(undefined)).toBeUndefined();
  });

  it("throws for zero", () => {
    expect(() => safeDate(0)).toThrow("valid date");
  });

  it("throws for negative", () => {
    expect(() => safeDate(-100)).toThrow("valid date");
  });

  it("throws for NaN", () => {
    expect(() => safeDate(NaN)).toThrow("valid date");
  });

  it("throws for Infinity", () => {
    expect(() => safeDate(Infinity)).toThrow("valid date");
  });

  it("uses custom name in error", () => {
    expect(() => safeDate(0, "pickup date")).toThrow("pickup date");
  });
});
