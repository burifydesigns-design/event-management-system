# Event Management System

Event ticketing platform with Attendee, Coordinator, Organizer and Admin roles.

## Technology
- Frontend: React, Vite, React Router and Axios
- Backend: Node.js and Express
- Database and authentication: Supabase PostgreSQL and Supabase Auth
- Hosting and deployment: Vercel only
- QR tickets: `qrcode`
- Email: Nodemailer with configured SMTP

MongoDB, Mongoose and MongoDB connection strings are not part of the supported application stack.

## Local development

```bash
cd backend
npm install
cp .env.example .env
npm run dev
npm test
```

Required backend environment:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to browser)
- `FRONTEND_URL`
- SMTP settings if email delivery is enabled

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

Frontend environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_URL` when the Express API is deployed separately

## Database
Schema changes are versioned under `supabase/migrations`. Apply new migrations to a dedicated staging Supabase project first, run security/performance advisors and role-based tests, then schedule production rollout. Do not use the production project as a staging environment.

The platform uses Supabase Auth for identity, `profiles` for application roles, and PostgreSQL tables for events, ticket types, registrations, orders, order items, payments, refunds and issued ticket instances. A pending order is not a paid order; tickets must only be issued after server-side verification of a payment provider webhook.

## Deployment
- Deploy the frontend and Express API through Vercel projects.
- Configure the Vercel project root/build settings for the relevant workspace.
- Set secrets in Vercel environment settings; never commit `.env` files.
- Remove any non-Vercel deployment integrations from the Git provider and hosting account. Repository source settings alone cannot disable an external provider's GitHub App or delete its hosted project.


## High-traffic reliability rollout

The `feat/high-traffic-reliability` branch adds the following production foundations:

- Atomic ticket holds and transactional checkout through `create_order_with_ticket_hold`.
- Ten-minute holds; schedule `release_expired_ticket_holds(500)` every minute using a trusted scheduler.
- M-Pesa Daraja STK Push with server-to-server STK query verification before ticket issuance.
- Payment settlement and ticket creation in one PostgreSQL transaction.
- Durable transactional email outbox delivered through Resend.
- Upstash Redis REST-backed rate limits for authentication and checkout.
- Helmet security headers, explicit CORS allowlist, request IDs and database-aware health checks.
- Supabase-backed event sales reporting instead of legacy Mongoose model calls.

### Required backend configuration

Configure these in the backend Vercel project's Environment Variables (never in the frontend):

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `PAYMENT_PROVIDER=mpesa`
- `MPESA_ENV` (`sandbox` first, then `production`), `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`
- `RESEND_API_KEY`, `EMAIL_FROM`, `OUTBOX_WORKER_TOKEN`
- `FRONTEND_URL` as an exact comma-separated list of permitted origins

### Scheduled jobs

Call these authenticated server-side jobs from QStash or another trusted scheduler:

- `POST /api/internal/outbox/process` with `Authorization: Bearer <OUTBOX_WORKER_TOKEN>` every 1–5 minutes.
- Call Supabase RPC `release_expired_ticket_holds(500)` every minute using a server-only service-role credential.

### Rollout safety

Apply the new SQL migrations to a staging Supabase project first. Test concurrent reservations, duplicate idempotency keys, expiry release, M-Pesa sandbox callbacks, duplicate callbacks, email retry behavior and organizer authorization before production. No production secrets are committed, and no migration is applied to your Supabase project by this repository change.
