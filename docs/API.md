# API Documentation

Base URL: `http://localhost:5000/api` (development).  
Content-Type: `application/json`. Authentication: `Authorization: Bearer <jwt>` unless noted.  
Roles: `attendee`, `organizer`, `admin`, `coordinator`.

## Authentication

### POST /api/auth/register
Register a new attendee. Public. Never assigns organizer/admin.
- Body: `{ name, email, password }`
- Email normalized (lowercase, trimmed). Password hashed. Duplicate email → `409`.
- Response `201`: `{ token, user: { _id, name, email, role } }`

### POST /api/auth/login
Validate credentials. Generic failure message (no account enumeration).
- Body: `{ email, password }`
- Response `200`: `{ token, user: { _id, name, email, role } }`; invalid → `401`

### GET /api/auth/me
Returns the authenticated user. Requires auth.
- Response `200`: `{ user: { _id, name, email, role } }`

### PUT /api/auth/profile
Update permitted profile fields (name). Role/protected fields ignored. Requires auth.
- Body: `{ name }`
- Response `200`: `{ user }`

### POST /api/auth/logout
Clears the auth cookie (bearer apps clear localStorage client-side). Requires auth.
- Response `200`: `{ message: 'Logged out successfully' }`

Rate limiting applies to `/api/auth` (20 requests / 15 min).

## Events

### GET /api/events
Public. Published events only.
- Query: `search`, `category`, `city`, `date` (upcoming|past), `price` (free|paid), `page`, `limit`
- Response: `{ events, page, limit, totalEvents, totalPages, pagination }`
- Pagination metadata: `page, limit, totalItems, totalPages, hasNextPage, hasPreviousPage`. Limit clamped to 100.

### GET /api/events/:id
Public. Draft/unpublished/cancelled events are only visible to the organizer or admin.
- Validates ObjectId. Missing → `404`.

### POST /api/events
Requires `organizer` or `admin`. Validates required fields (title, category, date, time, location, city, capacity, price). Organizer set from auth. Default `status=draft`.
- Response `201`: created event

### PUT /api/events/:id
Requires auth. Organizer may edit only their own events; admin may edit any. Protected fields (organizer, status, timestamps) stripped.
- Response `200`: updated event

### DELETE /api/events/:id
Requires auth. Organizer may delete only their own events; admin may delete any.

### PATCH /api/events/:id/publish
Requires `organizer` or `admin`. Toggles `draft` <-> `published`. Owner-or-admin enforced.

Event rules: valid dates, capacity ≥ 1, price ≥ 0. Registration blocked for cancelled/unpublished/finished events and after the registration deadline.

## Registrations

### POST /api/registrations
Authenticated attendee registers for an event. Checks event exists/published/not finished, no duplicate, capacity not exceeded, registration deadline not passed. Creates registration + ticket number. Sends confirmation email (best effort).
- Body: `{ eventId }`
- Response `201`: registration + event summary

### DELETE /api/registrations/:id
Cancel a registration. Owner or admin/organizer. Past events cannot be cancelled. Sets status `cancelled`.
- Response `200`: `{ message: 'Registration cancelled' }`

### GET /api/registrations/my-events
Authenticated user's registrations. Tabs: `upcoming`, `past`, `cancelled`, `all`. Paginated with `counts`.
- Query: `tab`, `page`, `limit`
- Response: `{ data, pagination, counts }`

### GET /api/registrations/:id
Registration owner or event organizer/admin.
- Response: registration + event + user (no password)

## Digital Tickets & QR

### GET /api/tickets/:id
Ticket (registration) visible to owner or event organizer/admin.

### GET /api/tickets/:id/qr
Server-generated QR data URL for the ticket token. Same authorization. QR payload contains only the ticket token — no passwords, tokens, or PII.

### POST /api/tickets/issue
Organizer/admin issues a ticket for an attendee to an event. Idempotent (no duplicate tickets for same user+event). Requires confirmed payment for paid orders.
- Body: `{ userId, eventId, ticketTypeId?, orderId? }`
- Response `201`: `{ ticket: { id, ticketNumber, qrToken, status, checkedIn, ... }, created: boolean }`

### POST /api/tickets/validate
Organizer/admin/coordinator pre-checks a ticket before check-in. No state change.
- Body: `{ qrToken, eventId }`
- Response: `{ valid, ticketNumber, status, checkedIn, event, attendee }`

### POST /api/tickets/check-in
Organizer/admin/coordinator atomically checks in a ticket. Coordinator limited to assigned events. Atomic `findOneAndUpdate` prevents duplicate check-ins under concurrency.
- Body: `{ qrToken, eventId }`
- Response: `{ result: 'valid'|'already_used'|'invalid'|'cancelled'|'wrong_event', message, ticketNumber, checkedIn }`

### POST /api/tickets/:id/resend-email
Owner or event staff resends the ticket email. Queues a new delivery attempt tracked in `TicketEmailLog`.
- Response `200`: `{ message: 'Ticket email queued', emailLogId }`

### GET /api/tickets/my
Authenticated attendee's own tickets. Paginated.

### POST /api/scan
Coordinator/organizer/admin scans a ticket QR code at the venue. Coordinator limited to assigned events.
- Body: `{ qrToken, eventId }`
- Response: `{ valid, result, message, ticketNumber }`

### GET /api/scan/events
Events the authenticated user is authorized to scan (admin: all published; organizer: own events; coordinator: assigned events).

### GET /api/scan/history
Check-in history for the authenticated staff member (admin/organizer: their events' scans; coordinator: own scans). Paginated.

## Coordinator Assignments

### POST /api/coordinator/assignments
Admin or organizer assigns a coordinator to an event. Organizer limited to their own events.
- Body: `{ coordinatorId, eventId }`
- Response `201`: `{ assignment }`

### GET /api/coordinator/assignments
List assignments (admin: all; organizer: own events; coordinator: own). Paginated.

### DELETE /api/coordinator/assignments/:id
Remove a coordinator assignment. Organizer limited to their own events.

### GET /api/coordinator/me/events
Events assigned to the authenticated coordinator.

### GET /api/coordinator/coordinators
List active coordinator users (admin/organizer).

## Analytics

### GET /api/analytics/overview
Admin only. Platform-wide metrics: users, events, registrations, attendance rate, gross revenue, paid orders, registration and check-in trends.

### GET /api/analytics/events/:id
Event-specific stats. Organizer/admin/coordinator of the event. Capacity utilization, confirmed/cancelled/checked-in counts, revenue, ticket-type sales, registration/check-in trends, hourly arrivals.

### GET /api/analytics/platform
Admin only. Platform-wide trends with date range (`start`, `end` query params, max 365 days). Registrations, check-ins, revenue over time; events by category; top events.

### GET /api/analytics/organizer
Organizer-scoped analytics across their events with date range filters. Revenue, registrations, check-ins, capacity utilization per event.

### GET /api/analytics/coordinator-performance
Admin/organizer/coordinator. Coordinator scan counts and outcomes (valid, failed, already used, wrong event, cancelled) with date range filters.

### GET /api/analytics/export/csv
Admin/organizer/coordinator. Export registrations as CSV scoped by role (admin: all; organizer: own events; coordinator: assigned events). Optional `eventId` filter.

## Admin

All admin endpoints require `admin` role. Passwords/tokens never returned.

### GET /api/admin/dashboard
Platform totals: users, events, registrations, upcoming events, available seats, checked-in attendees.

### GET /api/admin/users
List users (no passwords). Paginated.

### GET /api/admin/users/:id
Single user (no password).

### PATCH /api/admin/users/:id/role
Change role (`attendee`/`organizer`/`admin`/`coordinator`). Cannot demote the last active administrator or change your own admin role.

### PATCH /api/admin/users/:id/status
Activate/suspend an account. Cannot suspend the last active administrator or yourself.

### DELETE /api/admin/users/:id
Delete a user. Cannot delete yourself or the last active administrator.

### GET /api/admin/events
All events (draft + published) with registration counts. Paginated, searchable, filterable by status.

### DELETE /api/admin/events/:id
Admin deletes any event and its registrations.

### GET /api/admin/events/:eventId/attendees
Paginated attendees for an event (with user details).

### GET /api/admin/events/:eventId/attendees/export
CSV export of all registrations for an event (not just the current page). Fields escaped; formula injection protected.

## Orders & Payments

### POST /api/orders
Attendee creates an order for ticket(s). Order starts as `pending`; tickets are issued after payment confirmation.
- Body: `{ eventId, ticketTypeId, quantity }`

### GET /api/orders/my-tickets
Attendee's own ticket instances.

### POST /api/orders/confirm-payment
Attendee/organizer/admin confirms payment for an order and issues tickets. In production this should be triggered by a verified payment webhook.
- Body: `{ orderId }`

## System

### GET /api/health
Service status and database health indicator. No secrets or internals exposed.

Rate limiting applies to `/api/auth` (20 requests / 15 min) and sensitive endpoints (`/api/tickets/check-in`, `/api/tickets/issue`, `/api/tickets/*/resend-email`, `/api/scan`) at 60 requests / 1 min.

## Pagination contract
List responses use:
```
{
  page: number,
  limit: number,
  totalItems: number,
  totalPages: number,
  hasNextPage: boolean,
  hasPreviousPage: boolean
}
```
Some legacy endpoints also return `totalEvents`/`totalPages` for backward compatibility.
