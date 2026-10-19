# Event Management System

An event-management and ticketing application with a React/Vite frontend and a Node.js, Express, and MongoDB backend. Authentication uses JWTs; registrations produce digital tickets and QR codes for event check-in.

## Run locally

1. Configure the backend:

   ```powershell
   cd backend
   npm ci
   Copy-Item .env.example .env
   ```

   Set the MongoDB, JWT, and (if needed) SMTP values in `backend/.env`.

2. Start the API:

   ```powershell
   cd backend
   npm run dev
   ```

3. Start the frontend in another terminal:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

   Vite runs on port 3000. The frontend API URL defaults to `http://localhost:5000/api`; set `VITE_API_URL` to override it.

## Roles and administrative access

- **Attendee** — browses events, registers, and views personal tickets.
- **Organizer** — creates and manages owned events and scans tickets for those events.
- **Coordinator** — staff role supported by the application.
- **Admin** — manages platform events, attendees, users, and the admin dashboard.

Public registration always creates an attendee account. Role values in a registration request are ignored. Admin APIs require a valid JWT and the `admin` role; organizers can manage only events they own. Frontend route checks are an additional UX measure, not the authorization boundary.

Administrators may promote users through the existing authenticated `PUT /api/admin/users/:id` endpoint. The first admin must be provisioned by a trusted operator because this project intentionally has no public admin-bootstrap endpoint: create and verify the operator's normal account, then use an access-controlled MongoDB administrative connection to set that account's `users.role` to `admin`. Keep database credentials private, verify the target account before changing it, and audit the operation. Do not expose database access or create a public role-assignment endpoint.

## Admin dashboard

The protected `/dashboard` area provides live counts for events, active registrations, available seats at upcoming published events, and check-ins. Admins can search/filter events, create and edit them, and review event registrations and check-in status. Organizer and admin event mutations use the existing `/api/events` routes; admins also have read-only dashboard routes:

- `GET /api/admin/dashboard`
- `GET /api/admin/events?search=&category=&city=&status=&date=`
- `GET /api/admin/events/:eventId/attendees`

Dashboard counts use these definitions: total events includes all statuses; upcoming means published events dated today or later; past excludes cancelled events and is dated before today; active registrations are confirmed or checked-in registrations for non-cancelled events. Available seats are the non-negative capacity remaining at upcoming published events. Check-in totals exclude cancelled events.

Deleting an event with registration, order, ticket-instance, or ticket-type records changes its status to `cancelled`, preserving attendee, ticket, and check-in records. An event with no related records can be permanently deleted. Cancelled events are excluded from public listings and new registrations/orders, and cannot be checked in. There is no event-cancellation email workflow currently; organizers must notify registered attendees through their established communications process.

The dashboard adds the `cancelled` event status to the existing Mongoose enum. Existing records need no migration or index change.

## Tests and checks

Run backend tests (MongoDB Memory Server provides the isolated test database):

```powershell
cd backend
npm test -- --runInBand
```

Run focused dashboard and QR/check-in regression tests:

```powershell
cd backend
npm test -- --runInBand tests/adminDashboard.test.js tests/registration.test.js tests/qrService.test.js tests/scanController.test.js
```

Check the frontend:

```powershell
cd frontend
npm run lint
npm run build
```
