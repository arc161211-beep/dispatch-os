# DispatchOS Architecture

## Overview

DispatchOS is a private, multi-tenant freight dispatch management platform built for dispatch agencies and their carrier clients.

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Convex (real-time database + serverless functions)
- **Auth**: Convex Auth with Email OTP provider
- **Maps**: Leaflet with OpenStreetMap tiles
- **Charts**: Recharts
- **Animation**: Framer Motion

## Core Architecture Principles

1. **Security First**: All data access is authenticated and authorized server-side
2. **Multi-Tenant Isolation**: Organization ID is derived from authenticated session, never from client input
3. **Role-Based Access Control**: 7 distinct roles with different permission levels
4. **Financial Integrity**: All money values stored as integer cents; no floating-point for stored amounts
5. **Audit Trail**: Every significant mutation creates an audit log entry
6. **Idempotency**: Critical operations are safe to retry without side effects

## Authentication & Authorization

### Authentication Flow
1. User enters email on `/auth` page
2. Email OTP provider sends verification code
3. On verification, Convex Auth creates session
4. `users.provision` is called to check for pending invitations
5. If invitation exists: user joins org with invited role/carrier/driver assignment
6. If no invitation and no existing orgs: first user becomes admin of new org
7. Otherwise: access denied ("private platform")

### Roles
| Role | Read | Write | Admin | Portal |
|------|------|-------|-------|--------|
| super_admin | ✅ | ✅ | ✅ | Admin |
| admin | ✅ | ✅ | ✅ | Admin |
| dispatcher | ✅ | ✅ | ❌ | Admin |
| operations | ✅ | ✅ | ❌ | Admin |
| carrier_admin | ✅ (carrier) | ❌ | ❌ | Carrier |
| driver | ✅ (own) | ❌ | ❌ | Driver |
| read_only | ✅ | ❌ | ❌ | Admin |

### Scoping Rules
- **Organization scope**: Every query/mutation filters by `session.orgId`
- **Carrier scope**: `carrier_admin` only sees their linked carrier's data
- **Driver scope**: `driver` only sees their assigned load/truck/documents
- **Never trust client-provided orgId**: Always derived from authenticated user record

## Data Model (Convex Schema)

### Core Entities
- `organizations` — tenant root
- `users` — with role, orgId, carrierId, driverId, accountStatus
- `pendingUsers` — invitations with expiry and role
- `settings` — org configuration, fee defaults, notification prefs

### Operations
- `carriers` — carrier clients with fee config
- `trucks` — fleet vehicles with GPS coordinates
- `drivers` — personnel with availability and license info
- `brokers` — load broker contacts with risk flags
- `shippers` — shipping contacts
- `leads` — CRM leads with status pipeline

### Load Management
- `loads` — full load lifecycle with 18 statuses
- `loadStatusHistory` — immutable status change log
- `rateHistory` — financial change tracking

### Communications
- `conversations` — message threads per entity
- `messages` — individual messages with AI classification

### Documents
- `documents` — versioned, expiring file records

### Financial
- `invoices` — dispatcher fee invoices
- `payments` — payment records against invoices

### Tasks & Notifications
- `tasks` — follow-up and operational tasks
- `notifications` — user-scoped notifications
- `userNotificationPrefs` — per-user notification preferences

### AI
- `aiConversations` — AI chat sessions
- `aiMessages` — AI chat messages with tool calls

### Infrastructure
- `auditLogs` — append-only audit trail
- `integrations` — provider configuration status
- `importJobs` — CSV import history
- `webhooks` — incoming webhook records
- `locationHistory` — GPS location tracking

## Financial Rules

### Money Storage
All monetary values are stored as **integer cents** (e.g., $2,500.00 = 250000 cents).

### Dispatcher Fee Calculation
- **Percentage**: `feeCents = grossCents * ratePercent / 100`
- **Flat**: `feeCents = flatFeeCents`
- **Min/Max bounds** applied to percentage results
- **Carrier amount**: `carrierCents = grossCents - feeCents`

### Rate History
Every financial change to a load creates a `rateHistory` entry with:
- Field changed
- Previous value
- New value
- Actor (who made the change)
- Timestamp

### Invoice Lifecycle
1. Load completion → auto-create Draft invoice with calculated fee
2. Status changes: Draft → Sent → Viewed → Partially Paid → Paid
3. Payments are additive records (never overwrite)
4. Invoice balance: `amountCents - paidCents`
5. Idempotent: duplicate load completion is detected and prevented

## Load State Machine

```
Draft → Offered → Under Review → Negotiating → Awaiting Confirmation → Booked
Booked → Driver Notified → At Pickup → Loading → Loaded → In Transit
In Transit → At Delivery → Delivered → POD Pending → Completed
Any non-terminal → Cancelled
Any non-terminal → TONU Requested → Cancelled
Any → Disputed → Completed/Cancelled/Booked
```

## Location Architecture

- Multiple source types: driver_mobile, browser_geolocation, gps_telematics, manual
- Truck and driver locations tracked separately
- Location history with timestamps (never creation time)
- Staleness indicator: live (< 15min), recent, last known, unavailable
- Retention: configurable cleanup based on settings

## AI Architecture

- Provider: NVIDIA Nemotron 3 Ultra (OpenAI-compatible)
- Tool-based architecture with human approval gate
- System prompt restricts AI to operational data
- AI never books loads, changes rates, or makes financial commitments
- Suggestions require human approval before execution
- Fallback: "AI Not Configured" when API key is absent

## Provider Abstraction

All external providers are behind interfaces:
- AI (NVIDIA Nemotron)
- Email (not configured)
- SMS/WhatsApp (not configured)
- Maps (Leaflet/OsmD)
- Load Boards (not configured)
- Payments (not configured)
- E-Signature (not configured)
- GPS/Telematics (not configured)

Core system works without any external API.

## Security

### Headers
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(self)
- HSTS: max-age=31536000; includeSubDomains

### Webhook Security
- HMAC-SHA256 signature verification
- Constant-time comparison
- Duplicate detection by externalId
- Provider-specific secrets (WEBHOOK_SECRET_<PROVIDER>)

### Data Isolation
- Organization scoping on all queries
- Carrier scoping for portal users
- Driver scoping for driver portal
- No cross-tenant data leakage possible through URL manipulation
