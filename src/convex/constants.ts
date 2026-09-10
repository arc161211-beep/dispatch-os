// ---------------------------------------------------------------------------
// DispatchOS domain constants (pure TS — safe to import from schema, libs, and
// tests; never contains secrets).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Roles & Accounts
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

export const ACCOUNT_STATUSES = ["active", "suspended", "revoked", "invited"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const LOCATION_SOURCES = ["driver_mobile", "browser_geolocation", "gps_telematics", "manual", "other"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const CARRIER_FINANCIAL_VISIBILITY = ["full", "rate_only", "fee_visible", "none"] as const;
export type CarrierFinancialVisibility = (typeof CARRIER_FINANCIAL_VISIBILITY)[number];

/** Roles that can create/update operational records (carriers, loads, ...). */
export const WRITE_ROLES: Role[] = ["admin", "dispatcher", "operations"];
/** Roles that can manage users, settings, audit, integrations. */
export const ADMIN_ROLES: Role[] = ["super_admin", "admin"];
/** Roles that can access reports (operations, financial, CRM, dispatcher). */
export const REPORTS_ROLES: Role[] = ["super_admin", "admin", "dispatcher", "operations"];

// ---------------------------------------------------------------------------
// Fee Types — must match FeeConfig in lib/finance.ts
// ---------------------------------------------------------------------------

export const FEE_TYPES = ["percentage", "flat"] as const;
export type FeeType = (typeof FEE_TYPES)[number];

// ---------------------------------------------------------------------------
// Load Lifecycle
// ---------------------------------------------------------------------------

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

export const LOAD_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  "Draft":                   ["Offered", "Cancelled"],
  "Offered":                 ["Booked", "Cancelled", "Disputed"],
  "Under Review":            ["Offered", "Cancelled", "Disputed"],
  "Negotiating":             ["Booked", "Cancelled", "Disputed"],
  "Awaiting Confirmation":   ["Booked", "Cancelled", "Disputed"],
  "Booked":                  ["Driver Notified", "TONU Requested", "Cancelled", "Disputed"],
  "Driver Notified":         ["At Pickup", "Cancelled", "Disputed"],
  "At Pickup":               ["Loading", "TONU Requested", "Cancelled", "Disputed"],
  "Loading":                 ["Loaded", "Cancelled", "Disputed"],
  "Loaded":                  ["In Transit", "Cancelled", "Disputed"],
  "In Transit":              ["At Delivery", "Cancelled", "Disputed"],
  "At Delivery":             ["Delivered", "Cancelled", "Disputed"],
  "Delivered":               ["POD Pending"],
  "POD Pending":             ["Completed", "Disputed"],
  "Completed":               ["Disputed"],
  "Cancelled":               ["Disputed"],
  "TONU Requested":          ["Cancelled", "Disputed"],
  "Disputed":                ["Completed", "Cancelled", "Booked"],
};

export const TERMINAL_LOAD_STATUSES: readonly LoadStatus[] = ["Completed", "Cancelled"];

// ---------------------------------------------------------------------------
// Load Sources
// ---------------------------------------------------------------------------

export const LOAD_SOURCES = ["manual", "csv", "email", "api", "load_board", "other"] as const;
export type LoadSource = (typeof LOAD_SOURCES)[number];

// ---------------------------------------------------------------------------
// Carriers
// ---------------------------------------------------------------------------

export const CARRIER_STATUSES = ["Active", "Onboarding", "Suspended", "Inactive", "Prospect"] as const;
export type CarrierStatus = (typeof CARRIER_STATUSES)[number];

// ---------------------------------------------------------------------------
// Trucks
// ---------------------------------------------------------------------------

export const TRUCK_STATUSES = ["Available", "In Transit", "Booked", "Out of Service", "Maintenance"] as const;
export type TruckStatus = (typeof TRUCK_STATUSES)[number];

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export const DRIVER_STATUSES = ["Available", "On Load", "Off Duty", "On Leave"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

// ---------------------------------------------------------------------------
// Brokers
// ---------------------------------------------------------------------------

export const BROKER_STATUSES = ["New", "Active", "Inactive", "Suspended", "Under Review"] as const;
export type BrokerStatus = (typeof BROKER_STATUSES)[number];

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Active", "Converted", "Lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["manual", "referral", "website", "cold_call", "social_media", "advertisement", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const MESSAGE_STATUSES = ["unread", "read", "needs_reply", "resolved", "archived"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_PRIORITIES = ["low", "normal", "urgent"] as const;
export type MessagePriority = (typeof MESSAGE_PRIORITIES)[number];

export const CONVERSATION_TYPES = ["broker", "carrier", "driver", "lead", "internal", "system"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ["Follow Up", "Call", "Email", "Document", "Payment", "Other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPES = [
  "BOL",
  "Insurance",
  "Agreement",
  "W-9",
  "POD",
  "Rate Confirmation",
  "Invoice",
  "Carrier Agreement",
  "Other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOC_ALLOWED_EXTENSIONS: readonly string[] = [
  "pdf", "png", "jpg", "jpeg", "gif", "bmp",
  "doc", "docx",
  "xls", "xlsx",
  "csv", "txt",
];

export const DOC_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export const LOAD_DOC_CHECKLIST = [
  "Rate Confirmation",
  "BOL",
  "POD",
  "Invoice",
] as const;

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export const EQUIPMENT_TYPES = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Step Deck",
  "Lowboy",
  "Tanker",
  "Car Hauler",
  "Box Truck",
  "Other",
] as const;

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled", "Disputed"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export const AI_CATEGORIES = [
  "load_opportunity",
  "rate_inquiry",
  "status_update",
  "document_request",
  "payment",
  "general",
  "other",
] as const;
export type AiCategory = (typeof AI_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// ETA & Risk Status
// ---------------------------------------------------------------------------

export const ETA_STATUSES = ["on_time", "at_risk", "delayed", "unknown"] as const;
export type EtaStatus = (typeof ETA_STATUSES)[number];

export const RISK_STATUSES = ["on_time", "at_risk", "delayed", "unknown"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

// ---------------------------------------------------------------------------
// E-Signatures
// ---------------------------------------------------------------------------

export const SIGNATURE_REQUEST_STATUSES = ["pending", "in_progress", "completed", "declined", "expired", "cancelled"] as const;
export type SignatureRequestStatus = (typeof SIGNATURE_REQUEST_STATUSES)[number];

export const SIGNER_STATUSES = ["pending", "viewed", "signed", "declined"] as const;
export type SignerStatus = (typeof SIGNER_STATUSES)[number];

export const SIGNATURE_TYPES = ["draw", "upload", "typed"] as const;
export type SignatureType = (typeof SIGNATURE_TYPES)[number];

export const SIGNER_ROLES = ["carrier", "dispatcher", "broker", "shipper", "driver", "other"] as const;
export type SignerRole = (typeof SIGNER_ROLES)[number];

export const SIGNATURE_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// ---------------------------------------------------------------------------
// Integration Providers (for System Status page)
// ---------------------------------------------------------------------------

export const INTEGRATION_PROVIDERS = [
  { key: "ai", label: "AI Assistant (NVIDIA Nemotron)", envs: ["NVIDIA_API_KEY", "NVIDIA_BASE_URL", "NVIDIA_MODEL"] },
  { key: "email", label: "Email / OTP (Resend)", envs: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] },
  { key: "maps", label: "Maps (MapLibre + OpenFreeMap)", envs: [] },
  { key: "routing", label: "Routing (OpenRouteService)", envs: ["OPENROUTESERVICE_API_KEY"] },
  { key: "geocoding", label: "Geocoding (Geoapify)", envs: ["GEOAPIFY_API_KEY"] },
  { key: "weather", label: "Weather (Open-Meteo)", envs: [] },
  { key: "loadboard", label: "Load Board (TrukTek)", envs: [] },
  { key: "payments", label: "Payment Gateway", envs: ["STRIPE_SECRET_KEY"] },
] as const;
