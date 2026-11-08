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
