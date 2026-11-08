-- Event platform database architecture v2
-- Additive, backwards-compatible migration. Does not drop or rewrite existing business data.

create extension if not exists pgcrypto;

-- Events: support public URLs, timezone-aware scheduling and richer discovery metadata.
alter table public.events
  add column if not exists slug text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists currency char(3) not null default 'USD',
  add column if not exists published_at timestamptz,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists deleted_at timestamptz;
create unique index if not exists events_slug_unique_idx
  on public.events(slug) where slug is not null;
create index if not exists events_city_date_published_idx
  on public.events(city, event_date) where status = 'published' and deleted_at is null;

-- A venue is reusable across events; location remains on events for legacy clients.
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  region text,
  country_code char(2),
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text not null default 'UTC',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
alter table public.events add column if not exists venue_id uuid references public.venues(id) on delete set null;

-- Sessions make multi-day and multi-track events first-class without breaking event_date.
create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_id uuid references public.venues(id) on delete set null,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists event_sessions_event_start_idx on public.event_sessions(event_id, starts_at);

-- Memberships allow an organizer account/team to manage events without sharing logins.
create table if not exists public.organizer_members (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'manager' check (role in ('owner','manager','editor','check_in')),
  created_at timestamptz not null default now(),
  unique (organizer_id, member_id),
  check (organizer_id <> member_id)
);
create index if not exists organizer_members_member_idx on public.organizer_members(member_id);

-- Order line items snapshot price/name at purchase time; historical orders won't change
-- when organizers later edit ticket types.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Payment attempts are separate from orders: supports retries, provider webhooks and refunds.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  idempotency_key text,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null,
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','cancelled','refunded','partially_refunded')),
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  raw_provider_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payments_provider_reference_unique
  on public.payments(provider, provider_reference) where provider_reference is not null;
create unique index if not exists payments_idempotency_unique
  on public.payments(idempotency_key) where idempotency_key is not null;
create index if not exists payments_order_created_idx on public.payments(order_id, created_at desc);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  provider_reference text,
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','cancelled')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists refunds_provider_reference_unique
  on public.refunds(provider_reference) where provider_reference is not null;
create index if not exists refunds_payment_idx on public.refunds(payment_id);

-- Immutable audit trail for sensitive organizer/admin operations.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

-- The original schema accidentally allowed a one-ticket-type-per-event unique constraint
-- in some deployments. Keep the intended composite unique(event_id,name) instead.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.ticket_types'::regclass
      and contype = 'u'
      and (select array_agg(a.attname order by a.attname)
           from unnest(conkey) as k(attnum)
           join pg_attribute a on a.attrelid = conrelid and a.attnum = k.attnum) = array['event_id']::name[]
  loop
    execute format('alter table public.ticket_types drop constraint %I', c.conname);
  end loop;
end $$;
create unique index if not exists ticket_types_event_name_unique
  on public.ticket_types(event_id, name);

-- Enforce quantity and money consistency at the database boundary.
alter table public.orders add column if not exists currency char(3) not null default 'USD';
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_unique
  on public.orders(idempotency_key) where idempotency_key is not null;

-- Enable RLS on every newly exposed table.
alter table public.venues enable row level security;
alter table public.event_sessions enable row level security;
alter table public.organizer_members enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.audit_logs enable row level security;

-- Read-only public venue/session discovery for published events.
drop policy if exists venues_public_read on public.venues;
drop policy if exists venues_authenticated_read on public.venues;
create policy venues_public_read on public.venues for select to anon
using (exists (select 1 from public.events e where e.venue_id = venues.id and e.status = 'published' and e.deleted_at is null));
create policy venues_authenticated_read on public.venues for select to authenticated
using (exists (select 1 from public.events e where e.venue_id = venues.id and e.status = 'published' and e.deleted_at is null)
       or exists (select 1 from public.events e where e.venue_id = venues.id and e.organizer_id = (select auth.uid()))
       or (select private.has_role(array['admin'])));
drop policy if exists venues_manager_insert on public.venues;
create policy venues_manager_insert on public.venues for insert to authenticated
with check (created_by = (select auth.uid()) or (select private.has_role(array['admin'])));
drop policy if exists venues_manager_update on public.venues;
create policy venues_manager_update on public.venues for update to authenticated
using (created_by = (select auth.uid()) or (select private.has_role(array['admin'])))
with check (created_by = (select auth.uid()) or (select private.has_role(array['admin'])));
drop policy if exists venues_manager_delete on public.venues;
create policy venues_manager_delete on public.venues for delete to authenticated
using (created_by = (select auth.uid()) or (select private.has_role(array['admin'])));

drop policy if exists event_sessions_public_read on public.event_sessions;
drop policy if exists event_sessions_authenticated_read on public.event_sessions;
create policy event_sessions_public_read on public.event_sessions for select to anon
using (exists (select 1 from public.events e where e.id = event_sessions.event_id and e.status = 'published' and e.deleted_at is null));
create policy event_sessions_authenticated_read on public.event_sessions for select to authenticated
using (exists (select 1 from public.events e where e.id = event_sessions.event_id and e.status = 'published' and e.deleted_at is null)
       or exists (select 1 from public.events e where e.id = event_sessions.event_id and e.organizer_id = (select auth.uid()))
       or (select private.has_role(array['admin'])));
drop policy if exists event_sessions_manager_write on public.event_sessions;
create policy event_sessions_manager_write on public.event_sessions for all to authenticated
using (exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))))
with check (exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))));

-- Membership records are visible only to their organizer or admins.
drop policy if exists organizer_members_read on public.organizer_members;
create policy organizer_members_read on public.organizer_members for select to authenticated
using (organizer_id = (select auth.uid()) or member_id = (select auth.uid()) or (select private.has_role(array['admin'])));
drop policy if exists organizer_members_admin_manage on public.organizer_members;
create policy organizer_members_admin_manage on public.organizer_members for all to authenticated
using (organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))
with check (organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])));

-- Order items are visible to the order owner and admins; no client-side price mutation.
drop policy if exists order_items_read_owner on public.order_items;
create policy order_items_read_owner on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.attendee_id = (select auth.uid()) or (select private.has_role(array['admin'])))));

-- Payment and refund records are readable by owner/admin, but writes are server-only.
drop policy if exists payments_read_owner on public.payments;
create policy payments_read_owner on public.payments for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.attendee_id = (select auth.uid()) or (select private.has_role(array['admin'])))));
drop policy if exists refunds_read_owner on public.refunds;
create policy refunds_read_owner on public.refunds for select to authenticated
using (exists (select 1 from public.payments p join public.orders o on o.id = p.order_id
              where p.id = payment_id and (o.attendee_id = (select auth.uid()) or (select private.has_role(array['admin'])))));
revoke insert, update, delete on public.payments, public.refunds, public.audit_logs from anon, authenticated;
grant select on public.payments, public.refunds to authenticated;

-- Audit trail is admin-readable only; writes should be performed by trusted server/service role.
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
using ((select private.has_role(array['admin'])));

-- Updated-at triggers for mutable new entities.
do $$
declare t text;
begin
  foreach t in array array['venues','event_sessions','payments'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Remove accidental externally callable SECURITY DEFINER helper flagged by Supabase Advisor.
do $
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $;

-- Explicit Data API grants; RLS above remains the row-level boundary.
grant select on public.venues, public.event_sessions to anon, authenticated;
grant insert, update, delete on public.venues, public.event_sessions to authenticated;
grant select, insert, update, delete on public.organizer_members to authenticated;
grant select on public.order_items to authenticated;
grant select on public.audit_logs to authenticated;
