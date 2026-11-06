-- Supabase (PostgreSQL) schema for the Event Management System.
-- Apply this to the Supabase project: drksbvhyyblfkrdxmxvm
-- Replaces the previous MongoDB/Mongoose data layer.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'attendee',
  is_super_admin boolean not null default false,
  status text not null default 'active',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  date timestamptz not null,
  time text not null,
  location text not null,
  city text not null,
  capacity integer not null,
  price numeric not null default 0,
  image text not null default '',
  color_a text not null default '#c42a55',
  color_b text not null default '#ffb703',
  organizer uuid not null references users(id),
  status text not null default 'draft',
  registration_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ticket_types (
  id uuid primary key default gen_random_uuid(),
  event uuid not null references events(id),
  name text not null,
  price numeric not null,
  quantity_available integer not null,
  quantity_sold integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  attendee uuid not null references users(id),
  event uuid not null references events(id),
  total_amount numeric not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  user uuid not null references users(id),
  event uuid not null references events(id),
  order uuid references orders(id),
  ticket_type uuid references ticket_types(id),
  ticket_number text unique not null,
  qr_token text unique,
  status text not null default 'confirmed',
  cancelled_at timestamptz,
  cancelled_by uuid references users(id),
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid references users(id),
  registered_at timestamptz not null default now(),
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ticket_instances (
  id uuid primary key default gen_random_uuid(),
  order uuid not null references orders(id),
  ticket_type uuid not null references ticket_types(id),
  event uuid not null references events(id),
  attendee uuid not null references users(id),
  registration uuid references registrations(id),
  qr_token text unique not null,
  status text not null default 'issued',
  scanned_at timestamptz,
  scanned_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists check_in_logs (
  id uuid primary key default gen_random_uuid(),
  registration uuid not null references registrations(id),
  event uuid not null references events(id),
  ticket_number text not null,
  qr_token text not null,
  scanned_by uuid not null references users(id),
  scanned_by_role text not null,
  result text not null,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ticket_email_logs (
  id uuid primary key default gen_random_uuid(),
  registration uuid not null references registrations(id),
  status text not null default 'pending',
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists coordinator_assignments (
  id uuid primary key default gen_random_uuid(),
  coordinator uuid not null references users(id),
  event uuid not null references events(id),
  assigned_by uuid references users(id),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes matching the previous MongoDB access patterns.
create index if not exists events_status_date_idx on events(status, date);
create index if not exists events_category_date_idx on events(category, date);
create index if not exists events_organizer_status_idx on events(organizer, status);

create index if not exists registrations_user_event_idx on registrations(user, event);
create unique index if not exists registrations_user_event_unique_idx on registrations(user, event);
create index if not exists registrations_event_status_idx on registrations(event, status);
create index if not exists registrations_user_status_idx on registrations(user, status);
create unique index if not exists registrations_ticket_number_idx on registrations(ticket_number);
create unique index if not exists registrations_qr_token_idx on registrations(qr_token);

create index if not exists ticket_instances_qr_token_idx on ticket_instances(qr_token);
create index if not exists ticket_instances_event_status_idx on ticket_instances(event, status);
create index if not exists ticket_instances_attendee_idx on ticket_instances(attendee);

create index if not exists check_in_logs_event_scanned_at_idx on check_in_logs(event, scanned_at desc);
create index if not exists check_in_logs_scanned_by_scanned_at_idx on check_in_logs(scanned_by, scanned_at desc);
create index if not exists check_in_logs_result_scanned_at_idx on check_in_logs(result, scanned_at desc);

create index if not exists ticket_email_logs_registration_idx on ticket_email_logs(registration);
create index if not exists ticket_email_logs_status_attempt_idx on ticket_email_logs(status, last_attempt_at);

create unique index if not exists coordinator_assignments_coordinator_event_idx on coordinator_assignments(coordinator, event);
create index if not exists coordinator_assignments_event_idx on coordinator_assignments(event);

-- Row-level security is enabled so the frontend/anonymised client can be
-- scoped later. The backend uses the service-role key, which bypasses RLS.
alter table users enable row level security;
alter table events enable row level security;
alter table ticket_types enable row level security;
alter table orders enable row level security;
alter table registrations enable row level security;
alter table ticket_instances enable row level security;
alter table check_in_logs enable row level security;
alter table ticket_email_logs enable row level security;
alter table coordinator_assignments enable row level security;
