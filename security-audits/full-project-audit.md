# Full Project Security & Stability Audit

## Date

2026-09-25

## Branch

tests&fixes

## Project Baseline

Event Management System with React frontend (Vite) and Express/Mongoose backend. The project implements authentication, event management, registration, tickets, QR check-in, and admin features.

## Files Changed

### Backend
- `backend/src/middleware/authMiddleware.js` - Verified consistent `req.user.userId` usage across controllers
- `backend/src/models/Event.js` - Already has `visibility` (public/private) and `cancelled` status from step 18
- `backend/src/controllers/eventController.js` - Added `extractUserFromHeader` for private event auth without requiring auth middleware on `GET /:id`; fixed date parsing for upcoming/past classification
- `backend/src/controllers/registrationController.js` - Added private event check; fixed `getMyEvents` date parsing to use ISO date extraction before combining with time
- `backend/src/controllers/adminController.js` - Added `getAllEvents`, `getAllUsers`, `updateUserRole`, `deleteUser`; enriched analytics with event names
- `backend/src/controllers/scanController.js` - Rewritten to support both registration-based JSON QR codes and TicketInstance-based QR tokens; added event authorization check
- `backend/src/controllers/orderController.js` - Fixed `req.user._id` to `req.user.userId` for consistency
- `backend/src/routes/registrationRoutes.js` - Added `GET /:id` route for ticket detail
- `backend/src/routes/adminRoutes.js` - Added `/events`, `/users`, and user management routes
- `backend/.env` - Replaced real MongoDB credentials with localhost placeholder
- `backend/scripts/seedTestData.js` - Created test data seed script

### Frontend
- `frontend/src/services/eventService.js` - Already restored with `createEvent`, `updateEvent`, `deleteEvent`, `publishEvent` exports from step 18
- `frontend/src/components/Ticket.jsx` - Fixed async `QRCode.toDataURL` with `useEffect`; fixed dynamic classname interpolation; fixed attendee name to use `registration.user?.name`
- `frontend/src/components/EventCard.jsx` - Added image `onError` fallback
- `frontend/src/pages/EventDetails.jsx` - Added state checks for cancelled/past/unpublished events to disable registration button
- `frontend/src/pages/AdminAttendees.jsx` - Fixed attendee data field references to match backend response (`user.name`, `user.email`)
- `frontend/src/pages/AdminCheckIn.jsx` - Added event title to scan result display
- `frontend/.gitignore` - Added `.vercel`, `.env.*`, and `!.env.example`

### Cleanup
- Removed debug/scratch files from working tree: `chrome-*.txt`, `chrome-*.html`, `chrome-*.log`, `fe-build.log`, `fe-root.html`, `step18-*.jsx`, `frontend/repro.mjs`, `frontend/test-axios.mjs`
- Removed backup files: `SearchFilters.jsx.bak`, `Events.jsx.bak`, `eventService.js.bak`
- Fixed broken HTML escaping in `backend/src/templates/registrationConfirmation.js` and `backend/src/templates/reminderEmails.js`

## Security Findings

### Critical
1. **Real credentials in `.env`** (RESOLVED) - `backend/.env` contained a live MongoDB Atlas connection string with username and password. Replaced with localhost placeholder. **Note:** The previously exposed credentials should be rotated if the database is still in use.
2. **Real Vercel token in `.env.local`** (RESOLVED) - `.env.local` contained a live Vercel OIDC token. Removed and replaced with empty placeholder. **Note:** The previously exposed token should be revoked and regenerated.

### High
3. **Auth middleware `req.user` consistency** (VERIFIED) - JWT payload contains `userId`. All controllers on the current branch consistently use `req.user.userId`. Verified `orderController.js` was updated to match.
4. **Private event exposure** (RESOLVED) - `GET /events/:id` returned private events to unauthenticated users. Now returns 404 for unauthorized access using `extractUserFromHeader` helper.
5. **ReDoS in search** (RESOLVED) - User-supplied search/city strings were passed directly to `$regex` without escaping. Added `escapeRegex` utility.
6. **Broken HTML escaping in email templates** (RESOLVED) - `escapeHtml` functions in both email templates had literal characters instead of actual HTML entities.

### Medium
7. **Missing authorization on event details** (RESOLVED) - `getEvent` now checks event visibility and ownership.
8. **Missing route: GET /registrations/:id** (RESOLVED) - Frontend `DigitalTicket` called this route but it didn't exist. Added route and controller method.
9. **Missing admin routes** (RESOLVED) - Admin dashboard pages called endpoints that didn't exist. Added all missing routes.
10. **QR scan mismatch** (RESOLVED) - Frontend generated QR from registration JSON but backend expected `TicketInstance.qrToken`. Updated scan controller to handle both formats.
11. **Organizer authorization in scan** (RESOLVED) - Scan controller verifies scanner is event organizer or admin.
12. **`getMyEvents` date parsing bug** (RESOLVED) - Fixed invalid date string construction by extracting ISO date part before combining with time.

### Low
13. **`createdBy` field in User model** - `userController.js` references `createdBy` but the field doesn't exist. This controller is not mounted, so it doesn't affect runtime.
14. **No rate limiting** - Auth endpoints have no rate limiting, making them susceptible to brute-force attacks.
15. **No automated tests** - Project lacks test suite. Recommend adding tests for critical flows.

## Test Data

Created `backend/scripts/seedTestData.js` which creates:
- 3 test users: admin, organizer, attendee (password: `TestPass123!`)
- 6 test events with images from `picsum.photos`
- 1 initial registration for attendee on Burify Tech Summit

Test users:
- `admin.test@example.com` / `TestPass123!` (role: admin)
- `organizer.test@example.com` / `TestPass123!` (role: organizer)
- `attendee.test@example.com` / `TestPass123!` (role: attendee)

## Verified Flows

- Login/logout
- Public event listing (3 events visible)
- Private event access control (404 for unauthorized, 200 for owner/admin)
- Draft/cancelled events excluded from public listing
- Registration for published events
- Duplicate registration prevention
- Capacity enforcement
- My Events upcoming/past classification
- Ticket detail endpoint
- QR scan with registration-based QR codes
- Duplicate check-in rejection
- Admin dashboard
- Admin event list with registration counts
- Admin user management routes

## Recommendations

1. Rotate the previously exposed MongoDB credentials and Vercel token.
2. Add rate limiting to auth endpoints.
3. Consider adding `createdBy` field to User model if admin user creation is needed.
4. Add automated tests for critical flows (auth, registration, check-in).
5. Add input sanitization library (e.g., `express-validator`) for more robust validation.
