-- Security remediation for the event platform.
-- All sensitive writes are routed through the trusted Express service-role API.

drop policy if exists ticket_types_authenticated_access on public.ticket_types;
drop policy if exists ticket_types_manage_event_owner on public.ticket_types;
drop policy if exists ticket_types_authenticated_read_published_or_manager on public.ticket_types;
drop policy if exists ticket_types_read_published_or_manager on public.ticket_types;
drop policy if exists ticket_types_public_read_published on public.ticket_types;
create policy ticket_types_public_read_published on public.ticket_types
  for select to anon
  using (exists (select 1 from public.events e
    where e.id = ticket_types.event_id and e.status = 'published' and e.deleted_at is null));
create policy ticket_types_authenticated_read_published_or_manager on public.ticket_types
  for select to authenticated
  using (exists (select 1 from public.events e
    where e.id = ticket_types.event_id
      and ((e.status = 'published' and e.deleted_at is null)
        or e.organizer_id = (select auth.uid())
        or (select private.has_role(array['admin']))
        or exists (select 1 from public.organizer_members om
          where om.organizer_id = e.organizer_id and om.member_id = (select auth.uid())
            and om.role in ('owner','manager','check_in')))));
create policy ticket_types_insert_owner_or_admin on public.ticket_types
  for insert to authenticated with check (exists (select 1 from public.events e
    where e.id = ticket_types.event_id
      and (e.organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))));
create policy ticket_types_update_owner_or_admin on public.ticket_types
  for update to authenticated using (exists (select 1 from public.events e
    where e.id = ticket_types.event_id
      and (e.organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))))
  with check (exists (select 1 from public.events e
    where e.id = ticket_types.event_id
      and (e.organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))));
create policy ticket_types_delete_owner_or_admin on public.ticket_types
  for delete to authenticated using (exists (select 1 from public.events e
    where e.id = ticket_types.event_id
      and (e.organizer_id = (select auth.uid()) or (select private.has_role(array['admin'])))));

-- Prevent direct REST writes that bypass server-side price, stock and payment checks.
-- Event mutations also stay behind the role-checked Express API; this prevents direct REST
-- writes from publishing drafts or hard-deleting events and their dependent ticket data.
revoke insert, update, delete on public.events from anon, authenticated;
drop policy if exists registrations_insert_self on public.registrations;
drop policy if exists registrations_update_attendee_or_admin on public.registrations;
drop policy if exists orders_insert_self on public.orders;
revoke insert, update, delete on public.registrations from anon, authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.ticket_types from anon, authenticated;

-- Coordinators can read ticket records only for events assigned to their organizer team.
drop policy if exists tickets_read_owner_or_event_manager on public.ticket_instances;
create policy tickets_read_owner_or_event_manager on public.ticket_instances
  for select to authenticated using (
    attendee_id = (select auth.uid())
    or exists (select 1 from public.events e where e.id = ticket_instances.event_id
      and (e.organizer_id = (select auth.uid())
        or (select private.has_role(array['admin']))
        or exists (select 1 from public.organizer_members om
          where om.organizer_id = e.organizer_id and om.member_id = (select auth.uid())
            and om.role in ('owner','manager','check_in'))))
  );

-- Free legacy registrations are serialized on the event row. Paid events can only
-- be purchased through the order/payment flow and cannot use POST /registrations.
create or replace function public.register_free_event(
  p_user_id uuid, p_event_id uuid, p_ticket_number text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registration public.registrations%rowtype;
  v_confirmed integer;
begin
  if p_user_id is null or p_event_id is null
     or p_ticket_number is null or length(trim(p_ticket_number)) < 12 then
    raise exception using errcode = '22023', message = 'user, event and secure ticket number are required';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published'
     or v_event.deleted_at is not null or v_event.price <> 0 then
    raise exception using errcode = 'P0002', message = 'published free event not found';
  end if;
  if v_event.event_date < now() then
    raise exception using errcode = 'P0001', message = 'event is in the past';
  end if;

  select * into v_registration from public.registrations
    where user_id = p_user_id and event_id = p_event_id for update;
  if found and v_registration.status = 'confirmed' then
    return jsonb_build_object('registration', to_jsonb(v_registration), 'replayed', true);
  end if;

  select count(*)::integer into v_confirmed from public.registrations
    where event_id = p_event_id and status = 'confirmed';
  if v_confirmed >= v_event.capacity then
    raise exception using errcode = 'P0001', message = 'event is full';
  end if;

  if v_registration.id is not null then
    update public.registrations
      set status = 'confirmed', ticket_number = p_ticket_number,
          checked_in = false, checked_in_at = null, registered_at = now()
      where id = v_registration.id returning * into v_registration;
  else
    insert into public.registrations(user_id,event_id,ticket_number,status)
      values (p_user_id,p_event_id,p_ticket_number,'confirmed')
      returning * into v_registration;
  end if;
  return jsonb_build_object('registration', to_jsonb(v_registration), 'replayed', false);
end;
$$;

revoke all on function public.register_free_event(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.register_free_event(uuid,uuid,text) to service_role;
revoke insert, update, delete on public.payments, public.refunds from anon, authenticated;

-- Align new-event and new-order defaults with the platform's KES checkout defaults.
-- Existing rows and explicitly selected currencies are not rewritten.
alter table public.events alter column currency set default 'KES';
alter table public.orders alter column currency set default 'KES';
