// Central status styling + "Next Action" engine. The next-action suggestions
// are derived from record status — displayed everywhere as the primary UX cue.

const NEUTRAL = "bg-muted text-muted-foreground border-transparent";
const BLUE = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent";
const GREEN = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent";
const AMBER = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent";
const RED = "bg-red-500/10 text-red-600 dark:text-red-400 border-transparent";
const PURPLE = "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-transparent";
const GRAY = "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-transparent";

const MAP: Record<string, string> = {
  // Leads
  New: BLUE, Contacted: PURPLE, Interested: PURPLE, Qualified: PURPLE,
  "Documents Requested": AMBER, "Documents Received": AMBER, "Agreement Sent": AMBER, "Agreement Signed": GREEN,
  Onboarding: AMBER, Active: GREEN, Lost: RED, "Not Qualified": GRAY,
  // Carriers
  Prospect: BLUE, Paused: AMBER, Suspended: RED, Terminated: RED,
  // Trucks / drivers
  Available: GREEN, Booked: BLUE, "At Pickup": PURPLE, Loading: PURPLE, Loaded: BLUE, "In Transit": BLUE,
  "At Delivery": PURPLE, Delivered: GREEN, Maintenance: AMBER, "Out of Service": RED, Unavailable: GRAY,
  Driving: BLUE, "Off Duty": GRAY,
  // Brokers
  Preferred: GREEN, Review: AMBER, Blocked: RED,
  // Loads
  Draft: GRAY, Offered: BLUE, "Under Review": PURPLE, Negotiating: PURPLE, "Awaiting Confirmation": AMBER,
  "Driver Notified": BLUE, "POD Pending": AMBER, Completed: GREEN, Cancelled: RED, "TONU Requested": AMBER, Disputed: RED,
  // Invoices
  Sent: BLUE, Viewed: PURPLE, "Partially Paid": AMBER, Paid: GREEN, Overdue: RED,
  // Messages
  unread: BLUE, read: GRAY, needs_reply: AMBER, waiting: PURPLE, resolved: GREEN, archived: GRAY,
  // Priorities
  Low: GRAY, Normal: NEUTRAL, High: AMBER, Urgent: RED,
  // Misc
  Pending: AMBER, "In Progress": BLUE, none: NEUTRAL,
};

export function statusClass(status: string | null | undefined): string {
  if (!status) return NEUTRAL;
  return MAP[status] ?? NEUTRAL;
}

export interface NextAction {
  label: string;
  tone: "green" | "amber" | "red" | "blue" | "gray";
}

const TONE_CLASS: Record<NextAction["tone"], string> = {
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  gray: "bg-muted text-muted-foreground",
};

export function toneClass(tone: NextAction["tone"]): string {
  return TONE_CLASS[tone];
}

/** Next action engine — one central function for every entity type. */
export function nextAction(type: string, record: { status?: string | null; dueDate?: number | null; paidCents?: number; amountCents?: number; pickupDate?: number | null; deliveryDate?: number | null }): NextAction {
  const status = record.status ?? "";
  switch (type) {
    case "carrier":
      if (status === "Prospect") return { label: "Start onboarding", tone: "blue" };
      if (status === "Onboarding") return { label: "Complete onboarding review", tone: "amber" };
      if (status === "Paused") return { label: "Reactivate carrier", tone: "amber" };
      if (status === "Suspended") return { label: "Resolve suspension", tone: "red" };
      if (status === "Terminated") return { label: "Re-engage former client", tone: "gray" };
      return { label: "Book next load", tone: "green" };
    case "truck":
      if (status === "Available") return { label: "Find next load", tone: "green" };
      if (status === "Maintenance") return { label: "Return to service", tone: "amber" };
      if (status === "Out of Service" || status === "Unavailable") return { label: "Update availability", tone: "amber" };
      return { label: "Follow load progress", tone: "blue" };
    case "driver":
      if (status === "Available") return { label: "Assign next load", tone: "green" };
      if (status === "Off Duty") return { label: "Await return to duty", tone: "gray" };
      return { label: "Track on current load", tone: "blue" };
    case "load":
      if (status === "Draft") return { label: "Send offer to broker", tone: "blue" };
      if (status === "Offered" || status === "Under Review" || status === "Negotiating") return { label: "Awaiting broker response", tone: "amber" };
      if (status === "Awaiting Confirmation") return { label: "Awaiting rate confirmation", tone: "amber" };
      if (status === "Booked") return { label: "Notify driver", tone: "blue" };
      if (status === "Driver Notified") return { label: "Confirm driver en route", tone: "blue" };
      if (status === "POD Pending") return { label: "Collect POD from driver", tone: "amber" };
      if (status === "Delivered") return { label: "Request POD", tone: "amber" };
      if (status === "Disputed") return { label: "Resolve dispute", tone: "red" };
      if (status === "Cancelled") return { label: "Look for replacement load", tone: "gray" };
      if (status === "TONU Requested") return { label: "Follow up TONU payment", tone: "amber" };
      return { label: "Update status from field", tone: "blue" };
    case "invoice":
      if (record.dueDate && record.dueDate < Date.now() && status !== "Paid" && status !== "Cancelled")
        return { label: "Payment overdue — follow up", tone: "red" };
      if (status === "Draft") return { label: "Send invoice", tone: "blue" };
      if (status === "Sent" || status === "Viewed") return { label: "Follow up payment", tone: "amber" };
      if (status === "Partially Paid") return { label: "Collect remaining balance", tone: "amber" };
      if (status === "Paid") return { label: "Paid in full", tone: "green" };
      return { label: "Review invoice", tone: "gray" };
    case "lead":
      if (status === "New" || status === "Contacted") return { label: "Make first contact", tone: "blue" };
      if (status === "Interested" || status === "Qualified") return { label: "Qualify & request documents", tone: "blue" };
      if (status === "Agreement Sent") return { label: "Follow up agreement", tone: "amber" };
      if (status === "Agreement Signed" || status === "Onboarding") return { label: "Finish onboarding → convert", tone: "amber" };
      if (status === "Lost" || status === "Not Qualified") return { label: "Revisit in 90 days", tone: "gray" };
      return { label: "Nurture to activation", tone: "green" };
    case "document":
      return { label: "Upload document", tone: "amber" };
    default:
      return { label: "Review", tone: "gray" };
  }
}
