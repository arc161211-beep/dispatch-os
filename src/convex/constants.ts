// ---------------------------------------------------------------------------
// DispatchOS domain constants (pure TS — safe to import from schema, libs, and
// tests; never contains secrets).
// ---------------------------------------------------------------------------

export const ROLES = [
  "super_admin",
  "admin",
  "dispatcher",
  "operations",
  "carrier_admin",
  "driver",
  "read_only",
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can create/update operational records (carriers, loads, ...). */
export const WRITE_ROLES: Role[] = ["admin", "dispatcher", "operations"];
/** Roles that can manage users, settings, audit, integrations. */
export const ADMIN_ROLES: Role[] = ["super_admin", "admin"];

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Qualified",
  "Documents Requested",
  "Documents Received",
  "Agreement Sent",
  "Agreement Signed",
  "Onboarding",
  "Active",
  "Lost",
  "Not Qualified",
] as const;

export const LEAD_SOURCES = [
  "Facebook",
  "LinkedIn",
  "Website",
  "Referral",
  "Cold Call",
  "Cold Email",
  "WhatsApp",
  "Manual",
  "Other",
] as const;

export const CARRIER_STATUSES = [
  "Prospect",
  "Onboarding",
  "Active",
  "Paused",
  "Suspended",
  "Terminated",
] as const;

export const TRUCK_STATUSES = [
  "Available",
  "Booked",
  "At Pickup",
  "Loaded",
  "In Transit",
  "At Delivery",
  "Delivered",
  "Maintenance",
  "Out of Service",
  "Unavailable",
] as const;

export const DRIVER_STATUSES = [
  "Available",
  "Driving",
  "At Pickup",
  "Loading",
  "In Transit",
  "At Delivery",
  "Off Duty",
  "Unavailable",
] as const;

export const BROKER_STATUSES = [
  "New",
  "Active",
  "Preferred",
  "Review",
  "Blocked",
] as const;

export const LOAD_STATUSES = [
  "Draft",
  "Offered",
  "Under Review",
  "Negotiating",
  "Awaiting Confirmation",
  "Booked",
  "Driver Notified",
  "At Pickup",
  "Loading",
  "Loaded",
  "In Transit",
  "At Delivery",
  "Delivered",
  "POD Pending",
  "Completed",
  "Cancelled",
  "TONU Requested",
  "Disputed",
] as const;
export type LoadStatus = (typeof LOAD_STATUSES)[number];

/**
 * Valid load status transitions. Every transition is validated server-side,
 * recorded in loadStatusHistory and audit-logged. Nothing outside this map is
 * allowed.
 */
export const LOAD_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  Draft: ["Offered", "Cancelled"],
  Offered: [
    "Under Review",
    "Negotiating",
    "Awaiting Confirmation",
    "Booked",
    "Cancelled",
    "TONU Requested",
  ],
  "Under Review": [
    "Negotiating",
    "Awaiting Confirmation",
    "Booked",
    "Cancelled",
    "TONU Requested",
  ],
  Negotiating: ["Under Review", "Awaiting Confirmation", "Booked", "Cancelled", "TONU Requested"],
  "Awaiting Confirmation": ["Booked", "Negotiating", "Cancelled", "TONU Requested"],
  Booked: ["Driver Notified", "Cancelled", "TONU Requested", "Disputed"],
  "Driver Notified": ["At Pickup", "Cancelled"],
  "At Pickup": ["Loading", "Disputed"],
  Loading: ["Loaded", "Disputed"],
  Loaded: ["In Transit", "Disputed"],
  "In Transit": ["At Delivery", "Disputed"],
  "At Delivery": ["Delivered", "Disputed"],
  Delivered: ["POD Pending"],
  "POD Pending": ["Completed", "Disputed"],
  Completed: ["Disputed"],
  Cancelled: ["Disputed"],
  "TONU Requested": ["Cancelled", "Disputed"],
  Disputed: ["Completed", "Cancelled", "Booked"],
};

export const TERMINAL_LOAD_STATUSES: LoadStatus[] = ["Completed", "Cancelled"];

export const DOCUMENT_TYPES = [
  "Rate Confirmation",
  "BOL",
  "POD",
  "Insurance",
  "W-9",
  "Carrier Agreement",
  "Dispatch Agreement",
  "Detention",
  "Lumper Receipt",
  "Other",
] as const;

/** Document types that form the standard per-load checklist. */
export const LOAD_DOC_CHECKLIST = ["Rate Confirmation", "BOL", "POD"] as const;

export const DOC_ALLOWED_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
];
export const DOC_MAX_BYTES = 20 * 1024 * 1024; // 20MB

export const MESSAGE_STATUSES = [
  "unread",
  "read",
  "needs_reply",
  "waiting",
  "resolved",
  "archived",
] as const;

export const MESSAGE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const CONVERSATION_TYPES = [
  "broker",
  "carrier",
  "driver",
  "lead",
  "internal",
  "system",
] as const;

export const AI_CATEGORIES = [
  "Load Offer",
  "Rate Negotiation",
  "Rate Confirmation",
  "Pickup Update",
  "Delivery Update",
  "Detention",
  "Layover",
  "TONU",
  "POD Request",
  "Document Request",
  "Schedule Change",
  "Cancellation",
  "General",
  "Unknown",
] as const;

export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"] as const;
export const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
export const TASK_TYPES = [
  "Broker Follow-up",
  "Client Follow-up",
  "POD Request",
  "Rate Confirmation Check",
  "Detention Follow-up",
  "Document Renewal",
  "Lead Follow-up",
  "Onboarding",
  "Payment Follow-up",
  "General",
] as const;

export const INVOICE_STATUSES = [
  "Draft",
  "Sent",
  "Viewed",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Disputed",
  "Cancelled",
] as const;

export const FEE_TYPES = ["percentage", "flat"] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export const EQUIPMENT_TYPES = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Step Deck",
  "Power Only",
  "Box Truck",
  "Hot Shot",
  "Container",
  "Other",
] as const;

export const LOAD_SOURCES = ["manual", "csv", "email", "loadboard"] as const;

export const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export const ENTITY_TYPES = [
  "lead",
  "carrier",
  "truck",
  "driver",
  "broker",
  "shipper",
  "load",
  "invoice",
] as const;

export const INTEGRATION_PROVIDERS = [
  { key: "ai", label: "AI (NVIDIA Nemotron)", envs: ["NVIDIA_API_KEY", "NVIDIA_BASE_URL", "NVIDIA_MODEL"] },
  { key: "email", label: "Email", envs: ["EMAIL_API_KEY", "EMAIL_FROM"] },
  { key: "sms", label: "SMS / WhatsApp", envs: ["MESSAGING_API_KEY", "MESSAGING_PROVIDER"] },
  { key: "maps", label: "Maps & Routing", envs: ["MAPS_API_KEY"] },
  { key: "loadboard", label: "Load Board", envs: ["LOADBOARD_API_KEY", "LOADBOARD_PROVIDER"] },
  { key: "payments", label: "Payments", envs: ["PAYMENT_API_KEY", "PAYMENT_PROVIDER"] },
  { key: "storage", label: "File Storage", envs: ["STORAGE_API_KEY", "STORAGE_BUCKET"] },
  { key: "signature", label: "E-Signature", envs: ["SIGNATURE_API_KEY", "SIGNATURE_PROVIDER"] },
] as const;

export const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  carrier: "Carrier",
  truck: "Truck",
  driver: "Driver",
  broker: "Broker",
  shipper: "Shipper",
  load: "Load",
  invoice: "Invoice",
};
