# API Documentation

Base URL: `http://localhost:5000/api` (development).  
Content-Type: `application/json`. Authentication: `Authorization: Bearer <jwt>` unless noted.  
Roles: `attendee`, `organizer`, `admin`.

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
Server-generated QR data URL for the ticket number. Same authorization. QR payload contains only the ticket number — no passwords, tokens, or PII.

### POST /api/tickets/validate
Organizer/admin validates a ticket for their event.
- Body: `{ ticketNumber, eventId }`
- Response: `{ valid, ticketNumber, status, checkedIn, event, user }`

### POST /api/tickets/check-in
Organizer/admin checks in an attendee. Atomic update prevents duplicate check-ins. Records `checkedInAt` and `checkedInBy`.
- Body: `{ ticketNumber, eventId }`
- Response: `{ message, ticketNumber, checkedInAt }`

## Admin

All admin endpoints require `admin` role. Passwords/tokens never returned.

### GET /api/admin/dashboard
Platform totals: users, events, registrations, upcoming events, available seats, checked-in attendees.

### GET /api/admin/users
List users (no passwords). Paginated.

### GET /api/admin/users/:id
Single user (no password).

### PATCH /api/admin/users/:id/role
Change role (`attendee`/`organizer`/`admin`). Cannot demote the last active administrator or change your own admin role.

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

## Analytics

### GET /api/analytics/overview
Admin only. Platform metrics: total/published/upcoming events, total/confirmed/cancelled/checked-in registrations, attendance rate, registration trends over time.

### GET /api/analytics/events/:id
Event-specific stats. Organizer of the event or admin. Capacity utilization, confirmed/cancelled/checked-in counts, attendance rate, registration trends.

## System

### GET /api/health
Service status and database health indicator. No secrets or internals exposed.

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
