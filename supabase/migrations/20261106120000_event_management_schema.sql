-- Supabase schema for the event management application.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null,
 email text not null unique,
 role text not null default 'attendee' check (role in ('attendee','organizer','coordinator','admin')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 title text not null, description text not null, category text not null,
 event_date timestamptz not null, event_time text not null,
 location text not null, city text not null,
 capacity integer not null check(capacity>0),
 price numeric(12,2) not null default 0 check(price>=0),
 image text not null default '',
 organizer_id uuid not null references public.profiles(id),
 status text not null default 'draft' check(status in ('draft','published')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ticket_types (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 name text not null, price numeric(12,2) not null check(price>=0),
 quantity_available integer not null check(quantity_available>=0),
 quantity_sold integer not null default 0 check(quantity_sold>=0 and quantity_sold<=quantity_available),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,name)
);
create table if not exists public.registrations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 event_id uuid not null references public.events(id) on delete cascade,
 ticket_number text not null unique,
 status text not null default 'confirmed' check(status in ('confirmed','cancelled')),
 checked_in boolean not null default false, checked_in_at timestamptz,
 registered_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,event_id)
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 attendee_id uuid not null references public.profiles(id),
 event_id uuid not null references public.events(id),
 total_amount numeric(12,2) not null check(total_amount>=0),
 status text not null default 'pending' check(status in ('pending','paid','failed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ticket_instances (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 ticket_type_id uuid not null references public.ticket_types(id),
 event_id uuid not null references public.events(id),
 attendee_id uuid not null references public.profiles(id),
 qr_token text not null unique,
 status text not null default 'valid' check(status in ('valid','used','void')),
 scanned_at timestamptz, scanned_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists events_status_date_idx on public.events(status,event_date);
create index if not exists events_organizer_idx on public.events(organizer_id);
create index if not exists registrations_event_status_idx on public.registrations(event_id,status);
create index if not exists registrations_user_date_idx on public.registrations(user_id,registered_at desc);
create index if not exists orders_attendee_idx on public.orders(attendee_id,created_at desc);
create index if not exists orders_event_id_idx on public.orders(event_id);
create index if not exists tickets_attendee_idx on public.ticket_instances(attendee_id,created_at desc);
create index if not exists tickets_event_idx on public.ticket_instances(event_id,status);
create index if not exists ticket_instances_order_id_idx on public.ticket_instances(order_id);
create index if not exists ticket_instances_scanned_by_idx on public.ticket_instances(scanned_by);
create index if not exists ticket_instances_ticket_type_id_idx on public.ticket_instances(ticket_type_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
do $$ declare t text; begin
 foreach t in array array['profiles','events','ticket_types','registrations','orders','ticket_instances'] loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,email)
 values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),lower(new.email))
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
create or replace function private.has_role(required_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role=any(required_roles));
$$;
revoke all on function private.has_role(text[]) from public,anon;
grant execute on function private.has_role(text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.registrations enable row level security;
alter table public.orders enable row level security;
alter table public.ticket_instances enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.has_role(array['admin'])));
create policy profiles_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy events_read_published_or_owner on public.events for select to anon,authenticated using(status='published' or organizer_id=(select auth.uid()) or (select private.has_role(array['admin'])));
create policy events_insert_organizer_or_admin on public.events for insert to authenticated with check(organizer_id=(select auth.uid()) and (select private.has_role(array['organizer','admin'])));
create policy events_update_owner_or_admin on public.events for update to authenticated using(organizer_id=(select auth.uid()) or (select private.has_role(array['admin']))) with check(organizer_id=(select auth.uid()) or (select private.has_role(array['admin'])));
create policy events_delete_owner_or_admin on public.events for delete to authenticated using(organizer_id=(select auth.uid()) or (select private.has_role(array['admin'])));
create policy ticket_types_read_published_or_manager on public.ticket_types for select to anon,authenticated using(exists(select 1 from public.events e where e.id=event_id and (e.status='published' or e.organizer_id=(select auth.uid()) or (select private.has_role(array['admin'])))));
create policy ticket_types_manage_event_owner on public.ticket_types for all to authenticated using(exists(select 1 from public.events e where e.id=event_id and (e.organizer_id=(select auth.uid()) or (select private.has_role(array['admin']))))) with check(exists(select 1 from public.events e where e.id=event_id and (e.organizer_id=(select auth.uid()) or (select private.has_role(array['admin'])))));
create policy registrations_read_attendee_or_event_manager on public.registrations for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.events e where e.id=event_id and (e.organizer_id=(select auth.uid()) or (select private.has_role(array['admin'])))));
create policy registrations_insert_self on public.registrations for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.events e where e.id=event_id and e.status='published'));
create policy registrations_update_attendee_or_admin on public.registrations for update to authenticated using(user_id=(select auth.uid()) or (select private.has_role(array['admin']))) with check(user_id=(select auth.uid()) or (select private.has_role(array['admin'])));
create policy orders_read_owner_or_admin on public.orders for select to authenticated using(attendee_id=(select auth.uid()) or (select private.has_role(array['admin'])));
create policy orders_insert_self on public.orders for insert to authenticated with check(attendee_id=(select auth.uid()));
create policy tickets_read_owner_or_event_manager on public.ticket_instances for select to authenticated using(attendee_id=(select auth.uid()) or exists(select 1 from public.events e where e.id=event_id and (e.organizer_id=(select auth.uid()) or (select private.has_role(array['admin','coordinator'])))));

grant select on public.events,public.ticket_types to anon,authenticated;
grant select on public.profiles,public.registrations,public.orders,public.ticket_instances to authenticated;
grant update(name) on public.profiles to authenticated;
grant insert,update,delete on public.events,public.ticket_types to authenticated;
grant insert,update on public.registrations to authenticated;
grant insert on public.orders to authenticated;
