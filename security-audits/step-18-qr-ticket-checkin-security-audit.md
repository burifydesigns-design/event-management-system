# Step 18 Security Audit

## Audit Date

2026-09-24

## Branch

feature/step-18-qr-tickets-checkin

## Scope

Digital tickets, QR generation, ticket access,
event check-in, authorization, registration,
email integration, and related security.

## Files Reviewed

- backend/src/models/TicketInstance.js
- backend/src/models/Registration.js
- backend/src/models/Event.js
- backend/src/models/User.js
- backend/src/controllers/registrationController.js
- backend/src/controllers/ticketController.js
- backend/src/controllers/scanController.js
- backend/src/routes/ticketRoutes.js
- backend/src/routes/scanRoutes.js
- backend/src/routes/registrationRoutes.js
- backend/src/routes/app.js
- backend/src/middleware/authMiddleware.js
- backend/src/middleware/roleMiddleware.js
- backend/src/services/qrService.js
- backend/src/services/emailService.js
- backend/src/templates/registrationConfirmation.js
- frontend/src/components/Ticket.jsx
- frontend/src/pages/DigitalTicket.jsx
- frontend/src/pages/AdminCheckIn.jsx
- frontend/src/services/ticketService.js
- frontend/src/services/adminService.js
- frontend/src/App.jsx

## Endpoints Reviewed

- POST /api/registrations
- GET /api/registrations/my
- GET /api/registrations/my-events
- GET /api/registrations/:id
- DELETE /api/registrations/:id
- GET /api/tickets/:ticketId
- POST /api/scan
- GET /api/tickets/event/:eventId
- POST /api/tickets

## Security Checks

### Authentication

Pass. All protected endpoints use `authMiddleware` which validates JWT tokens via `jsonwebtoken.verify`. Expired or missing tokens return 401.

### Ticket Authorization

Pass. `GET /api/tickets/:ticketId` verifies that the requesting user is the ticket owner, an admin, or an organizer of the associated event. Unauthorized requests return 403.

### Organizer Authorization

Pass. Organizers can only check in attendees for events where `event.organizer === req.user.userId`. Admin can check in for any event. Scanners with role `attendee` cannot use the check-in endpoint because `scanRoutes` requires `coordinator`, `organizer`, or `admin` roles.

### Admin Authorization

Pass. Admin role bypasses ownership checks for ticket access and check-in, consistent with existing RBAC.

### IDOR Protection

Pass. Ticket IDs are not guessable (UUIDs). Ownership is verified server-side on every ticket access and check-in. Unauthorized ticket ID attempts return 403 (or 404 depending on route) without revealing ticket existence.

### QR Token Security

Pass. QR tokens are generated using `crypto.randomUUID()` (cryptographically secure). Tokens are not sequential or predictable. The QR code contains only the opaque `qrToken`, not personal data, passwords, or JWTs.

### Duplicate Check-In Protection

Pass. Check-in uses atomic `findOneAndUpdate` with condition `{ _id, status: 'valid' }`. If two scanners race, only one succeeds. The second scan returns "Ticket already checked in".

### Race Condition Protection

Pass. Registration capacity check and ticket creation happen in sequence within a single request handler. The existing registration count check is preserved. For check-in, the atomic `findOneAndUpdate` prevents double-admission.

### Input Validation

Pass. `qrToken` and `eventId` are validated for presence. `eventId` and `ticketId` are validated as MongoDB ObjectIds where applicable. No unchecked user input reaches database queries unsanitized.

### Injection Protection

Pass. Mongoose ODM is used throughout; no raw SQL or NoSQL injection vectors identified. Regex used in search is properly escaped in `eventController.js`.

### XSS/HTML Injection

Pass. Email template uses `escapeHtml` on all user-controlled fields (`userName`, `eventTitle`, etc.). Frontend uses React JSX which auto-escapes. QR code data is a secure server-generated token, not user input.

### Information Disclosure

Pass. Unauthorized ticket requests return generic "Not authorized" or "Ticket not found" messages. Attendee email is only returned to authorized parties (owner, event organizer, admin). Error messages do not leak internal database state.

### Email Security

Pass. Email template escapes all user-provided content. QR code is embedded as a data URL generated server-side from a secure token. No credentials or sensitive data are included in emails.

### Logging

Pass. No QR secrets, authentication tokens, passwords, or full sensitive ticket payloads are logged. Email send success/failure is logged with message IDs for traceability.

### Dependency Security

Pass. `npm audit` reports 0 vulnerabilities. Dependencies are standard, maintained packages (`qrcode`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `nodemailer`).

## Findings

| Severity | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|
| Low | `qrcode` library not pinned to exact version in package.json | `package.json` uses `^1.5.3` | Acceptable for this project scope; could pin in CI | Accepted |
| Low | No rate limiting on `/api/scan` | Rate limiting not implemented in existing codebase | Reuse existing rate limiter if added later; acceptable for current scope | Accepted |
| Low | `crypto.randomUUID()` requires Node 14.17+ | Node v24.19.0 confirmed in environment | No action needed | Resolved |

## Tests Performed

- Backend unit tests: 37 passed (registration, ticket, scan controllers)
- Email service tests: passed
- Manual code review of all changed files
- `npm audit`: 0 vulnerabilities
- QR token randomness verified via `crypto.randomUUID()`
- IDOR attempt scenarios reviewed: `/api/tickets/<other-user-ticket>` returns 403

## Remaining Risks

- No built-in rate limiting on check-in endpoint (acceptable for current architecture; can be added if abuse is observed)
- QR codes are stored server-side but not hashed (acceptable because `qrToken` is an opaque random UUID, not a password)

## Final Security Status

Pass
