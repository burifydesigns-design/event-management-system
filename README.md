# Event Management System

A Supabase-backed event discovery, registration and ticketing platform with Attendee, Coordinator, Organizer and Admin roles.

## Architecture

- **Frontend:** React, Vite, React Router and Axios.
- **Backend:** Node.js and Express.
- **Database and authentication:** Supabase Postgres, Supabase Auth and Row Level Security.
- **Hosting:** Vercel only.
- **Ticket QR codes:** server-generated QR tokens and images.
- **Email:** Nodemailer with SMTP configuration.

MongoDB, Mongoose, MongoDB Atlas and MongoDB-specific test infrastructure are not part of the target architecture. Supabase is the sole application database and authentication provider.

## Features

- Attendees browse published events, register and access their tickets.
- Organizers create and manage events and ticket types.
- Coordinators validate tickets at event check-in.
- Administrators manage users, events, reporting and exports.
- Event sessions, reusable venues, organizer memberships, order items, payments, refunds and audit records are defined in the database architecture migration.

## Repository structure

- `backend/` — Express API, Supabase access, auth middleware, controllers and routes.
- `frontend/` — React/Vite application.
- `supabase/migrations/` — versioned Postgres schema and policy migrations.

## Local development

Install dependencies from the repository root:

```bash
npm install
```

Configure backend environment variables in `backend/.env` and frontend variables in `frontend/.env`. Never commit environment files or credentials.

Start the backend:

```bash
npm run dev --workspace backend
```

Start the frontend:

```bash
npm run dev --workspace frontend
```

Build the frontend:

```bash
npm run build --workspace frontend
```

Run backend tests:

```bash
npm test --workspace backend
```

## Environment configuration

### Backend

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service role key. Never expose this to the browser.
- `SUPABASE_ANON_KEY` — legacy anon key if required by the server auth client; use the project publishable key where supported.
- `FRONTEND_URL` — allowed Vercel frontend origin(s).
- `PORT` — API port.
- SMTP variables — required only when email delivery is enabled.

### Frontend

- `VITE_SUPABASE_URL` — Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key.
- `VITE_API_URL` — deployed API base URL.

Only public/publishable Supabase credentials may be included in Vite variables. Never place service-role keys, database passwords or provider secrets in frontend environment variables.

## Database

Apply migrations to a dedicated staging Supabase project first. Validate schema, foreign keys, triggers, grants, RLS policies and application workflows before applying them to production. Do not run the architecture migration against production until staging verification and explicit rollout approval are complete.

The current production database contains no event records. Existing legacy MongoDB data has not been imported; a source export is required before any historical data migration can be performed.

## Deployment

Deploy the frontend and backend exclusively through Vercel. Configure the Vercel project with the appropriate root/build settings and environment variables. Netlify is not an approved hosting or preview provider for this repository.
