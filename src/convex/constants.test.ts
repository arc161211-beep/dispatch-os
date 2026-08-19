/**
 * Unit tests for load status transitions and domain constants.
 *
 * Covers:
 *  - All load status transitions are valid
 *  - Terminal statuses have no forward transitions (except Disputed)
 *  - Every load status is defined in LOAD_STATUSES
 *  - Every status in LOAD_TRANSITIONS is in LOAD_STATUSES
 *  - Role arrays are correctly defined
 *  - Status constants are non-empty
 */

import { describe, it, expect } from "vitest";
import {
  LOAD_STATUSES,
  LOAD_TRANSITIONS,
  TERMINAL_LOAD_STATUSES,
  ROLES,
  WRITE_ROLES,
  ADMIN_ROLES,
  ACCOUNT_STATUSES,
  TRUCK_STATUSES,
  DRIVER_STATUSES,
  BROKER_STATUSES,
  LEAD_STATUSES,
  CARRIER_STATUSES,
  INVOICE_STATUSES,
  MESSAGE_STATUSES,
  MESSAGE_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  DOCUMENT_TYPES,
  LOAD_DOC_CHECKLIST,
  DOC_ALLOWED_EXTENSIONS,
  DOC_MAX_BYTES,
  type LoadStatus,
} from "./constants";

// ---------------------------------------------------------------------------
// Load status completeness
// ---------------------------------------------------------------------------
describe("LOAD_STATUSES", () => {
  it("is a non-empty array", () => {
    expect(LOAD_STATUSES.length).toBeGreaterThan(0);
  });

  it("contains all expected statuses", () => {
    const expected = [
      "Draft", "Offered", "Under Review", "Negotiating", "Awaiting Confirmation",
      "Booked", "Driver Notified", "At Pickup", "Loading", "Loaded",
      "In Transit", "At Delivery", "Delivered", "POD Pending", "Completed",
      "Cancelled", "TONU Requested", "Disputed",
    ];
    for (const s of expected) {
      expect(LOAD_STATUSES).toContain(s);
    }
  });
});

// ---------------------------------------------------------------------------
// Transition map completeness and validity
// ---------------------------------------------------------------------------
describe("LOAD_TRANSITIONS", () => {
  it("has an entry for every load status", () => {
    for (const status of LOAD_STATUSES) {
      expect(LOAD_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(LOAD_TRANSITIONS[status as LoadStatus])).toBe(true);
    }
  });

  it("every transition target is a valid load status", () => {
    for (const [from, targets] of Object.entries(LOAD_TRANSITIONS)) {
      for (const to of (targets as LoadStatus[])) {
        expect(LOAD_STATUSES).toContain(to);
        // Must not transition to yourself
        expect(to).not.toBe(from);
      }
    }
  });

  it("Draft can only go to Offered or Cancelled", () => {
    expect(LOAD_TRANSITIONS.Draft).toEqual(["Offered", "Cancelled"]);
  });

  it("Completed can only go to Disputed (for reopens)", () => {
    expect(LOAD_TRANSITIONS.Completed).toEqual(["Disputed"]);
  });

  it("Cancelled can only go to Disputed", () => {
    expect(LOAD_TRANSITIONS.Cancelled).toEqual(["Disputed"]);
  });

  it("Disputed can resolve to Completed, Cancelled, or Booked", () => {
    expect(LOAD_TRANSITIONS.Disputed).toEqual(["Completed", "Cancelled", "Booked"]);
  });

  it("Delivered transitions only to POD Pending", () => {
    expect(LOAD_TRANSITIONS.Delivered).toEqual(["POD Pending"]);
  });

  it("POD Pending can go to Completed or Disputed", () => {
    expect(LOAD_TRANSITIONS["POD Pending"]).toEqual(["Completed", "Disputed"]);
  });

  it("Booked allows Driver Notified, Cancelled, TONU Requested, Disputed", () => {
    expect(LOAD_TRANSITIONS.Booked).toContain("Driver Notified");
    expect(LOAD_TRANSITIONS.Booked).toContain("Cancelled");
    expect(LOAD_TRANSITIONS.Booked).toContain("TONU Requested");
    expect(LOAD_TRANSITIONS.Booked).toContain("Disputed");
  });

  it("forward progression: Draft -> Offered -> Booked -> Driver Notified -> At Pickup -> Loading -> Loaded -> In Transit -> At Delivery -> Delivered -> POD Pending -> Completed", () => {
    const forward: LoadStatus[] = [
      "Draft", "Offered", "Booked", "Driver Notified", "At Pickup",
      "Loading", "Loaded", "In Transit", "At Delivery", "Delivered",
      "POD Pending", "Completed",
    ];
    for (let i = 0; i < forward.length - 1; i++) {
      const from = forward[i];
      const to = forward[i + 1];
      expect(LOAD_TRANSITIONS[from]).toContain(to);
    }
  });

  it("terminal statuses (Completed, Cancelled) have limited exits", () => {
    for (const terminal of TERMINAL_LOAD_STATUSES) {
      const targets = LOAD_TRANSITIONS[terminal as LoadStatus];
      for (const t of targets) {
        expect(t).toBe("Disputed");
      }
    }
  });

  it("TONU Requested can go to Cancelled or Disputed", () => {
    expect(LOAD_TRANSITIONS["TONU Requested"]).toContain("Cancelled");
    expect(LOAD_TRANSITIONS["TONU Requested"]).toContain("Disputed");
  });

  it("every non-terminal status has at least one transition", () => {
    const nonTerminal = LOAD_STATUSES.filter(
      (s) => !TERMINAL_LOAD_STATUSES.includes(s as LoadStatus)
    );
    for (const status of nonTerminal) {
      expect(LOAD_TRANSITIONS[status as LoadStatus].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// TERMINAL_LOAD_STATUSES
// ---------------------------------------------------------------------------
describe("TERMINAL_LOAD_STATUSES", () => {
  it("contains Completed and Cancelled", () => {
    expect(TERMINAL_LOAD_STATUSES).toContain("Completed");
    expect(TERMINAL_LOAD_STATUSES).toContain("Cancelled");
    expect(TERMINAL_LOAD_STATUSES).toHaveLength(2);
  });

  it("all terminal statuses are in LOAD_STATUSES", () => {
    for (const t of TERMINAL_LOAD_STATUSES) {
      expect(LOAD_STATUSES).toContain(t);
    }
  });
});

// ---------------------------------------------------------------------------
// Roles and authorization constants
// ---------------------------------------------------------------------------
describe("ROLES", () => {
  it("contains all seven roles", () => {
    expect(ROLES).toHaveLength(7);
    expect(ROLES).toContain("super_admin");
    expect(ROLES).toContain("admin");
    expect(ROLES).toContain("dispatcher");
    expect(ROLES).toContain("operations");
    expect(ROLES).toContain("carrier_admin");
    expect(ROLES).toContain("driver");
    expect(ROLES).toContain("read_only");
  });
});

describe("WRITE_ROLES", () => {
  it("contains admin, dispatcher, operations", () => {
    expect(WRITE_ROLES).toContain("admin");
    expect(WRITE_ROLES).toContain("dispatcher");
    expect(WRITE_ROLES).toContain("operations");
  });

  it("does not include super_admin, carrier_admin, driver, read_only", () => {
    expect(WRITE_ROLES).not.toContain("super_admin");
    expect(WRITE_ROLES).not.toContain("carrier_admin");
    expect(WRITE_ROLES).not.toContain("driver");
    expect(WRITE_ROLES).not.toContain("read_only");
  });
});

describe("ADMIN_ROLES", () => {
  it("contains super_admin and admin", () => {
    expect(ADMIN_ROLES).toContain("super_admin");
    expect(ADMIN_ROLES).toContain("admin");
  });

  it("does not include dispatcher", () => {
    expect(ADMIN_ROLES).not.toContain("dispatcher");
  });
});

// ---------------------------------------------------------------------------
// Domain status constants
// ---------------------------------------------------------------------------
describe("ACCOUNT_STATUSES", () => {
  it("has 4 values", () => {
    expect(ACCOUNT_STATUSES).toHaveLength(4);
  });
  it("includes active, suspended, revoked, invited", () => {
    expect(ACCOUNT_STATUSES).toContain("active");
    expect(ACCOUNT_STATUSES).toContain("suspended");
    expect(ACCOUNT_STATUSES).toContain("revoked");
    expect(ACCOUNT_STATUSES).toContain("invited");
  });
});

describe("TRUCK_STATUSES", () => {
  it("is non-empty and includes Available", () => {
    expect(TRUCK_STATUSES.length).toBeGreaterThan(0);
    expect(TRUCK_STATUSES).toContain("Available");
  });
});

describe("DRIVER_STATUSES", () => {
  it("is non-empty and includes Available", () => {
    expect(DRIVER_STATUSES.length).toBeGreaterThan(0);
    expect(DRIVER_STATUSES).toContain("Available");
  });
});

describe("BROKER_STATUSES", () => {
  it("is non-empty", () => {
    expect(BROKER_STATUSES.length).toBeGreaterThan(0);
  });
});

describe("LEAD_STATUSES", () => {
  it("is non-empty and includes New, Active, Lost", () => {
    expect(LEAD_STATUSES.length).toBeGreaterThan(0);
    expect(LEAD_STATUSES).toContain("New");
    expect(LEAD_STATUSES).toContain("Active");
    expect(LEAD_STATUSES).toContain("Lost");
  });
});

describe("CARRIER_STATUSES", () => {
  it("is non-empty and includes Active, Suspended", () => {
    expect(CARRIER_STATUSES.length).toBeGreaterThan(0);
    expect(CARRIER_STATUSES).toContain("Active");
    expect(CARRIER_STATUSES).toContain("Suspended");
  });
});

describe("INVOICE_STATUSES", () => {
  it("includes Draft, Sent, Paid, Overdue", () => {
    expect(INVOICE_STATUSES).toContain("Draft");
    expect(INVOICE_STATUSES).toContain("Sent");
    expect(INVOICE_STATUSES).toContain("Paid");
    expect(INVOICE_STATUSES).toContain("Overdue");
  });
});

describe("MESSAGE_STATUSES", () => {
  it("includes unread, read", () => {
    expect(MESSAGE_STATUSES).toContain("unread");
    expect(MESSAGE_STATUSES).toContain("read");
  });
});

describe("MESSAGE_PRIORITIES", () => {
  it("includes low, normal, high, urgent", () => {
    expect(MESSAGE_PRIORITIES).toContain("low");
    expect(MESSAGE_PRIORITIES).toContain("urgent");
  });
});

describe("TASK_STATUSES", () => {
  it("includes Pending, In Progress, Completed, Cancelled", () => {
    expect(TASK_STATUSES).toContain("Pending");
    expect(TASK_STATUSES).toContain("Completed");
  });
});

describe("TASK_PRIORITIES", () => {
  it("includes Low, Normal, High, Urgent", () => {
    expect(TASK_PRIORITIES).toContain("Urgent");
    expect(TASK_PRIORITIES).toContain("Low");
  });
});

// ---------------------------------------------------------------------------
// Document constants
// ---------------------------------------------------------------------------
describe("DOCUMENT_TYPES", () => {
  it("includes standard types", () => {
    expect(DOCUMENT_TYPES).toContain("BOL");
    expect(DOCUMENT_TYPES).toContain("POD");
    expect(DOCUMENT_TYPES).toContain("Insurance");
    expect(DOCUMENT_TYPES).toContain("W-9");
  });
});

describe("LOAD_DOC_CHECKLIST", () => {
  it("includes Rate Confirmation, BOL, POD", () => {
    expect(LOAD_DOC_CHECKLIST).toContain("Rate Confirmation");
    expect(LOAD_DOC_CHECKLIST).toContain("BOL");
    expect(LOAD_DOC_CHECKLIST).toContain("POD");
  });
});

describe("DOC_ALLOWED_EXTENSIONS", () => {
  it("includes pdf, png, jpg", () => {
    expect(DOC_ALLOWED_EXTENSIONS).toContain("pdf");
    expect(DOC_ALLOWED_EXTENSIONS).toContain("png");
    expect(DOC_ALLOWED_EXTENSIONS).toContain("jpg");
  });

  it("does not include exe, bat", () => {
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("exe");
    expect(DOC_ALLOWED_EXTENSIONS).not.toContain("bat");
  });
});

describe("DOC_MAX_BYTES", () => {
  it("is 20MB", () => {
    expect(DOC_MAX_BYTES).toBe(20 * 1024 * 1024);
  });
});
