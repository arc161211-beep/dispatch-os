# DispatchOS Changelog

All notable changes to DispatchOS are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Security
- Fixed `tasks.setStatus` using `requireOrg` instead of `requireWrite` — read-only users could change task status
- Added lat/lon coordinate range validation in location mutations (lat: -90 to 90, lon: -180 to 180)
- Added NaN/Infinity validation for invoice amounts and payment amounts
- Added coordinate validation for truck creation and updates
- Added coordinate validation for bulk location updates (skips invalid coordinates)

### Performance
- Replaced unbounded `.collect()` with bounded `.take()` in reports queries (max 2000 records)
- Replaced unbounded `.collect()` with bounded `.take(500)` in webhook duplicate detection
- Replaced unbounded `.collect()` with bounded `.take(2000)` in broker detail loads query
- Replaced unbounded `.collect()` with bounded `.take(2000)` in lead detail tasks query
- Optimized `messages.unreadStats` to use indexed queries per status instead of scanning all messages
- Optimized `aiInternal.listConversations` to use per-conversation bounded queries instead of loading all AI messages

### Tests
- Added comprehensive security regression test suite (71 tests) covering:
  - Cross-tenant isolation verification
  - Role-based access control boundary testing
  - Financial calculation edge cases ($0, very small, very large, min/max bounds)
  - Load state machine integrity verification
  - Coordinate validation ranges
  - Invoice/payment amount validation
  - Document extension security
  - Webhook duplicate detection logic
  - Matching engine score bounds
  - Idempotency properties
  - Rounding integrity

### Changed
- Total test count increased from 176 to 247 (all passing)

## [0.1.0] - 2025-01-01

### Added
- Core application architecture (React 19, TypeScript, Vite, Convex)
- Authentication (email OTP, anonymous disabled)
- Multi-tenant organization isolation
- Role-based authorization (7 roles)
- Carrier management with agreements
- Truck management with GPS coordinates
- Driver management with availability tracking
- Broker management with risk flags
- Shipper management
- Lead CRM with conversion to carrier
- Load management with 18-status state machine
- Load matching engine (0-100 score)
- Dispatcher fee calculation (percentage/flat, min/max bounds)
- Invoice management with payment tracking
- Payment recording with balance validation
- Document management with upload, versioning, expiry
- Message/conversation system with search and filters
- Task management
- Notification system with preferences and quiet hours
- AI assistant architecture (NVIDIA Nemotron)
- Location tracking with history
- Truck map (Leaflet with OpenStreetMap)
- Global search
- Reports (operations, financial, CRM, dispatcher)
- CSV import/export for all entity types
- Audit logging
- Webhook infrastructure with HMAC verification
- System health endpoint
- Security headers (CSP, HSTS, X-Frame-Options)
- Demo data seeding and clearing
- Carrier portal
- Driver portal
- User management (admin invite/activate/suspend/revoke)
- Settings page with fee configuration
- Dashboard with real-time stats
