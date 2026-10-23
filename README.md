# Event Management System

Ticketing platform with four roles: Attendee, Coordinator, Organizer, Admin.

## Features

- **Attendee** — browse events, register, purchase tickets, receive QR-coded tickets by email, view own tickets.
- **Coordinator** — mobile-friendly QR ticket scanner for assigned events, check-in history, event-specific attendee lookup.
- **Organizer** — create/manage events and ticket types, view attendee lists, assign coordinators, live check-in analytics, revenue and sales charts.
- **Admin** — platform-wide administration, user and role management, event approval, audit analytics, CSV exports.

## QR Ticket System

1. Attendee registers/purchases a ticket → server creates a `Registration` with a cryptographically secure `qrToken`.
2. Ticket email is sent automatically with a professionally designed HTML ticket containing the QR code.
3. Authorized staff scan the QR at the venue using the mobile-friendly scanner.
4. Backend validates the ticket atomically (prevents double check-in) and records the check-in with staff member and timestamp.
5. Analytics dashboards refresh with live check-in and sales data.

## Stack
- Frontend: React (Vite), React Router, Axios, Chart.js (react-chartjs-2)
- Backend: Node.js, Express, MongoDB (Mongoose)
- Auth: JWT (bearer token, stored in localStorage)
- Password hashing: bcryptjs
- Email: Nodemailer (configurable SMTP) with retry and delivery tracking
- QR codes: qrcode library (server-side generation)
- Charts: Chart.js via react-chartjs-2
- Tests: Jest + Supertest + mongodb-memory-server

## Roles
- **Attendee** — signs up, browses events, registers, views own tickets/QR codes.
- **Coordinator** — account created by admin; scans attendee QR codes for assigned events only; views check-in history.
- **Organizer** — creates/edits/publishes/deletes own events, views attendees, checks in attendees, assigns coordinators, event analytics.
- **Admin** — full privileges, including user management, platform analytics, CSV exports.

## Project structure
```
backend/            Node.js/Express API
  src/
    config/         DB connection, env config
    controllers/    Route handlers (thin)
    middleware/     auth, roles, validation, error handling
    models/         Mongoose models (User, Event, Registration, TicketInstance, TicketType, Order, CoordinatorAssignment, TicketEmailLog, CheckInLog)
    routes/         Express routers
    services/       email, QR, payment, ticket issuance
    utils/          pagination, CSV export
  tests/            Jest tests
  server.js         Entry point
frontend/           React Vite app
  src/
    components/, context/, pages/, services/, styles/
```

## Getting started

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in your values (see Configuration below)
npm run dev            # nodemon, http://localhost:5000
npm test               # Jest test suite
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # Vite dev server, http://localhost:3000
npm run build          # production build
npm run lint           # ESLint
```
The Vite dev server proxies `/api` requests to `http://localhost:5000` (see `frontend/vite.config.js`).

## Configuration

### Backend (`.env`)
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend port | `5000` |
| `MONGO_URI` | MongoDB connection string (Atlas or local) | `mongodb+srv://...` |
| `JWT_SECRET` | Secret used to sign JWTs | strong random string |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |
| `FRONTEND_URL` | Allowed CORS origin (production) | `https://app.example.com` |
| `SMTP_HOST` | SMTP host | `smtp.example.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `EMAIL_FROM` | From address | `no-reply@example.com` |
| `SUPPORT_EMAIL` | Support contact on ticket emails | `support@example.com` |
| `NODE_ENV` | `development` or `production` | `development` |

Never commit real `.env` files or secrets. `.env` is gitignored. Required variables (`MONGO_URI`, `JWT_SECRET`) are validated at startup.

### Frontend (`frontend/.env`)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend base URL | `http://localhost:5000/api` |

## Available scripts

Backend (`backend/package.json`):
- `npm start` — production server
- `npm run dev` — nodemon dev server
- `npm test` — Jest tests

Frontend (`frontend/package.json`):
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — ESLint

## Scanner Requirements

The QR scanner uses the device camera via `navigator.mediaDevices.getUserMedia`.
- **HTTPS required** in production (camera access is restricted to secure contexts).
- `localhost` is exempt from the HTTPS requirement for development.
- Camera permission must be granted by the user.
- A fallback manual ticket-reference entry is provided when the camera is unavailable.

## Deployment
- Frontend: build (`npm run build`) and deploy `frontend/dist` to Vercel. Set `VITE_API_URL` to the production backend URL.
- Backend: deploy `backend/` to Render or Railway. Set all `.env` variables, including `FRONTEND_URL` to the Vercel origin and `MONGO_URI` to MongoDB Atlas.
- Use MongoDB Atlas for the database. Enable TLS and restrict network access.
- In production, set `NODE_ENV=production` so generic error responses are returned and stack traces are hidden.

## API documentation
See `docs/API.md` for the full endpoint contract (auth, events, registrations, tickets, admin, analytics, system).
