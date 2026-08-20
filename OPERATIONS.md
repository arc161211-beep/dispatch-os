# DispatchOS Operations Guide

## System Status

Check system health:
- Health endpoint: `GET /api/health`
- Returns: `{ ok: true, service: "dispatchos", time: <timestamp> }`
- If this fails, the HTTP router or Convex backend is down

## Troubleshooting

### Login Fails

**Symptoms**: User cannot sign in, gets error or loops back to login page

**Check**:
1. Is the user's email registered? (check `pendingUsers` table)
2. Is the account status "active"? (not suspended/revoked)
3. Is the user's org provisioned? (check `users.orgId`)
4. Has the invitation expired? (invitations expire after 7 days)

**Fix**: Admin creates new invitation via User Management page

### Convex Backend Unavailable

**Symptoms**: App shows loading spinners, mutations fail

**Check**:
1. Run `bun convex dev --once` to verify backend connectivity
2. Check Convex dashboard for deployment status
3. Verify API keys in environment

**Fix**: Platform-managed; contact support if persistent

### AI Assistant Unavailable

**Symptoms**: "AI Not Configured" message in assistant panels

**Check**:
1. Verify `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL` are set in Keys/API keys
2. Test API connectivity: the AI endpoint should respond to chat completions

**Fix**: Add NVIDIA API credentials in the project's Keys/API keys tab. The system works fully without AI.

### Map Not Loading

**Symptoms**: Map tab shows "No truck locations available" or blank map

**Check**:
1. Do trucks have valid GPS coordinates? (lat/lon must be within -90/90 and -180/180)
2. Is Leaflet loading? (check browser console for import errors)
3. Are OpenStreetMap tiles accessible? (network connectivity)

**Fix**: Truck locations must be manually entered or shared by drivers via the portal

### Email Notifications Not Sending

**Symptoms**: Users don't receive email notifications

**Check**:
1. Is email provider configured? (check Integrations page)
2. Are notification preferences enabled? (Settings → Notification Preferences)
3. Are quiet hours blocking non-urgent notifications?

**Fix**: In-app notifications always work. Email delivery requires email provider configuration.

### Duplicate Invoices

**Symptoms**: Multiple invoices for the same load

**Check**: The system has idempotency protection. If duplicates appear:
1. Check if load completion was triggered multiple times
2. Verify the `invoices` table for matching `loadId` values
3. Check audit logs for `invoice.created` entries

**Fix**: Delete duplicate Draft invoices via the Finance page. Paid invoices cannot be deleted.

### Loads Stuck in Wrong Status

**Symptoms**: Load status doesn't match operational reality

**Check**:
1. Review `loadStatusHistory` for the load
2. Verify the transition is allowed in the state machine
3. Check if driver/carrier scoping prevents the status change

**Fix**: Use the Disputed status to reopen any completed/cancelled load, then correct the status

### Carrier Cannot See Their Data

**Symptoms**: Carrier portal shows empty or unauthorized

**Check**:
1. Is the user assigned carrier_admin role?
2. Is the carrierId correctly set on the user record?
3. Is the carrier record in "Active" status?

**Fix**: Admin → User Management → edit user → assign carrier

### Driver Cannot Update Location

**Symptoms**: "You can only update your assigned truck's location"

**Check**:
1. Is the user assigned driver role?
2. Does the user have a driverId linked?
3. Is the driver linked to a truck?
4. Is that truck linked to an active load?

**Fix**: Admin assigns driver to truck via Driver Management

### Import Fails

**Symptoms**: CSV import shows errors or doesn't insert records

**Check**:
1. Required columns present? (see import dialog for required headers)
2. Duplicate detection? (same name/MC number already exists)
3. Carrier/Truck references exist? (carrier must be created first)

**Fix**: Fix CSV data and retry. Each row is validated independently.

## Data Recovery

### Critical Data
1. **Users & Auth** — managed by Convex Auth; cannot be manually edited
2. **Organizations** — tenant root; never delete
3. **Invoices & Payments** — financial records; append-only recommended
4. **Audit Logs** — compliance records; never delete
5. **Load History** — operational records; use status changes, not deletion

### Export Mechanism
- CSV export available on most list pages (Carriers, Trucks, Drivers, Loads, etc.)
- Uses `ExportCsvButton` component with proper scoping
- Exports respect role and carrier scope

### Restore Procedure
1. If application logic breaks: fix code, run `bun convex dev --once`
2. If database corruption: contact Convex support for point-in-time recovery
3. If environment is lost: redeploy from codebase + reconfigure API keys

## Monitoring

### Health Check
- `GET /api/health` returns system status
- No secrets exposed in health response

### Audit Trail
- Every mutation creates an audit log entry
- Viewable via Admin → Audit Log page
- Filterable by action type and entity type

### Key Metrics to Watch
- Active loads count
- Overdue invoices
- Missing PODs
- Urgent messages
- Expiring documents (insurance, licenses)

## Security Reminders

1. **Never share API keys** in chat, email, or documents
2. **Rotate webhook secrets** if compromised
3. **Review audit logs** regularly for unauthorized access
4. **Suspend accounts** immediately if compromised
5. **Test backup procedures** periodically
6. **Keep dependencies updated** for security patches
