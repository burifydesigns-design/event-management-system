-- High-traffic checkout hardening: atomic inventory holds and transactional checkout.
-- Additive migration; existing orders and tickets remain intact.

alter table public.ticket_types
  add column if not exists quantity_reserved integer not null default 0;

alter table public.ticket_types
  drop constraint if exists ticket_types_quantity_reserved_check;
alter table public.ticket_types
  add constraint ticket_types_quantity_reserved_check
  check (
    quantity_reserved >= 0
    and quantity_sold >= 0
    and quantity_sold + quantity_reserved <= quantity_available
  );

alter table public.orders
  add column if not exists hold_expires_at timestamptz;

create index if not exists orders_pending_hold_expiry_idx
  on public.orders(hold_expires_at)
  where status = 'pending' and hold_expires_at is not null;

-- This function is called by the trusted Express API using the service-role client.
-- UPDATE ... WHERE available capacity remains is the inventory serialization point.
create or replace function public.create_order_with_ticket_hold(
  p_attendee_id uuid,
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_quantity integer,
  p_idempotency_key text,
  p_payment_provider text default 'unconfigured'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_ticket public.ticket_types%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_existing public.orders%rowtype;
  v_total numeric(12,2);
  v_currency char(3);
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if p_attendee_id is null or p_event_id is null or p_ticket_type_id is null then
    raise exception using errcode = '22023', message = 'attendee, event and ticket type are required';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception using errcode = '22023', message = 'quantity must be between 1 and 10';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'a valid idempotency key is required';
  end if;

  -- Replaying the same request returns the original checkout without reserving twice.
  select * into v_existing
  from public.orders
  where attendee_id = p_attendee_id and idempotency_key = p_idempotency_key;

  if found then
    select * into v_payment from public.payments where order_id = v_existing.id order by created_at desc limit 1;
    return jsonb_build_object('order', to_jsonb(v_existing), 'payment', to_jsonb(v_payment), 'replayed', true);
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for share;

  if not found or v_event.status <> 'published' or v_event.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'event is not available for purchase';
  end if;
  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    raise exception using errcode = 'P0001', message = 'registration has not opened';
  end if;
  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    raise exception using errcode = 'P0001', message = 'registration is closed';
  end if;

  -- A single conditional UPDATE atomically checks and reserves inventory.
  update public.ticket_types
  set quantity_reserved = quantity_reserved + p_quantity
  where id = p_ticket_type_id
    and event_id = p_event_id
    and quantity_available - quantity_sold - quantity_reserved >= p_quantity
  returning * into v_ticket;

  if not found then
    raise exception using errcode = 'P0001', message = 'not enough tickets are available';
  end if;

  -- Opportunistically release expired holds so availability recovers even when a
  -- scheduler invocation is delayed. A scheduled worker still handles idle periods.
  perform public.release_expired_ticket_holds(100);

  v_total := v_ticket.price * p_quantity;
  v_currency := coalesce(v_event.currency, 'KES');

  insert into public.orders (
    attendee_id, event_id, total_amount, currency, status, idempotency_key, hold_expires_at
  ) values (
    p_attendee_id, p_event_id, v_total, v_currency, 'pending', p_idempotency_key, v_expires_at
  ) returning * into v_order;

  insert into public.order_items (order_id, ticket_type_id, description, quantity, unit_price)
  values (v_order.id, v_ticket.id, v_ticket.name, p_quantity, v_ticket.price);

  insert into public.payments (
    order_id, provider, amount, currency, status, idempotency_key
  ) values (
    v_order.id, coalesce(nullif(p_payment_provider, ''), 'unconfigured'),
    v_total, v_currency, 'pending', p_idempotency_key
  ) returning * into v_payment;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'order_id', v_payment.order_id,
      'provider', v_payment.provider,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'status', v_payment.status,
      'created_at', v_payment.created_at
    ),
    'replayed', false
  );
exception
  when unique_violation then
    -- Concurrent duplicate submissions with the same key are resolved by returning
    -- the committed original order, never by creating a second reservation.
    select * into v_existing
    from public.orders
    where attendee_id = p_attendee_id and idempotency_key = p_idempotency_key;
    if found then
      select * into v_payment from public.payments where order_id = v_existing.id order by created_at desc limit 1;
      return jsonb_build_object('order', to_jsonb(v_existing), 'payment', to_jsonb(v_payment), 'replayed', true);
    end if;
    raise;
end;
$$;

revoke all on function public.create_order_with_ticket_hold(uuid,uuid,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.create_order_with_ticket_hold(uuid,uuid,uuid,integer,text,text) to service_role;

-- Invoke from a scheduled trusted job (pg_cron, QStash or an operator-triggered job).
-- SKIP LOCKED makes concurrent cleanup runs safe.
create or replace function public.release_expired_ticket_holds(p_batch_size integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released integer := 0;
  v_hold record;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'batch size must be between 1 and 5000';
  end if;

  for v_hold in
    select o.id, oi.ticket_type_id, oi.quantity
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'pending'
      and o.hold_expires_at is not null
      and o.hold_expires_at <= now()
    order by o.hold_expires_at
    limit p_batch_size
    for update of o skip locked
  loop
    update public.ticket_types
    set quantity_reserved = greatest(0, quantity_reserved - v_hold.quantity)
    where id = v_hold.ticket_type_id;

    update public.orders
    set status = 'failed', hold_expires_at = null
    where id = v_hold.id and status = 'pending';

    update public.payments
    set status = 'cancelled'
    where order_id = v_hold.id and status in ('pending','processing');

    v_released := v_released + 1;
  end loop;

  return v_released;
end;
$$;

revoke all on function public.release_expired_ticket_holds(integer) from public, anon, authenticated;
grant execute on function public.release_expired_ticket_holds(integer) to service_role;
