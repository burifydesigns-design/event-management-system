# Event Management System

Ticketing platform with four roles: Attendee, Coordinator, Organizer, Admin.

## Stack
- Frontend: React (Vite), React Router, Axios
- Backend: Node.js, Express, MongoDB (Mongoose)
- Auth: JWT (bearer token, stored in localStorage)
- Password hashing: bcryptjs
- Email: Nodemailer (configurable SMTP)
- QR codes: qrcode library
- Tests: Jest + Supertest + mongodb-memory-server

## Roles
- **Attendee** — signs up, browses events, registers, views own tickets/QR codes.
- **Coordinator** — account created by admin; scans attendee QR codes to confirm a ticket is valid.
- **Organizer** — creates/edits/publishes/deletes own events, views attendees, checks in attendees.
- **Admin** — full privileges, including user management, platform analytics, CSV exports.

## Project structure
```
backend/            Node.js/Express API
  src/
    config/         DB connection, env config
    controllers/    Route handlers (thin)
    middleware/     auth, roles, validation, error handling
    models/         Mongoose models (User, Event, Registration, TicketInstance, TicketType, Order)
    routes/         Express routers
    services/       email, QR, payment
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

## Deployment
- Frontend: build (`npm run build`) and deploy `frontend/dist` to Vercel. Set `VITE_API_URL` to the production backend URL.
- Backend: deploy `backend/` to Render or Railway. Set all `.env` variables, including `FRONTEND_URL` to the Vercel origin and `MONGO_URI` to MongoDB Atlas.
- Use MongoDB Atlas for the database. Enable TLS and restrict network access.
- In production, set `NODE_ENV=production` so generic error responses are returned and stack traces are hidden.

## API documentation
See `docs/API.md` for the full endpoint contract (auth, events, registrations, tickets, admin, analytics, system).
