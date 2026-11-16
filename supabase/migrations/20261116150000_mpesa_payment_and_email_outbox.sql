-- Payment verification, ticket issuance and durable email outbox.
-- Provider callbacks never issue tickets directly: only the verified transaction RPC does.

alter table public.payments
  add column if not exists provider_checkout_id text,
  add column if not exists provider_merchant_id text,
  add column if not exists provider_receipt text,
  add column if not exists provider_phone text,
  add column if not exists provider_response jsonb;

create unique index if not exists payments_provider_checkout_unique
  on public.payments(provider, provider_checkout_id)
  where provider_checkout_id is not null;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_outbox_ready_idx
  on public.email_outbox(status, available_at, created_at)
  where status in ('pending','failed');
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;

create or replace function public.complete_mpesa_order_payment(
  p_checkout_request_id text,
  p_receipt text,
  p_amount numeric,
  p_currency text,
  p_provider_event jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_profile public.profiles%rowtype;
  v_event public.events%rowtype;
  v_ticket_count integer := 0;
begin
  select * into v_payment
  from public.payments
  where provider = 'mpesa' and provider_checkout_id = p_checkout_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment reference not found';
  end if;

  if v_payment.status = 'succeeded' then
    return jsonb_build_object('success', true, 'replayed', true, 'order_id', v_payment.order_id);
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'order not found';
  end if;
  if v_order.status <> 'pending' or v_order.hold_expires_at is null or v_order.hold_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'order hold expired or is no longer payable';
  end if;
  if upper(coalesce(p_currency, '')) <> 'KES' or v_payment.currency <> 'KES' then
    raise exception using errcode = '22023', message = 'payment currency mismatch';
  end if;
  if round(p_amount, 2) <> round(v_payment.amount, 2) then
    raise exception using errcode = '22023', message = 'payment amount mismatch';
  end if;
  if p_receipt is null or length(trim(p_receipt)) < 5 then
    raise exception using errcode = '22023', message = 'valid M-Pesa receipt is required';
  end if;

  select * into v_profile from public.profiles where id = v_order.attendee_id;
  select * into v_event from public.events where id = v_order.event_id;

  for v_item in
    select ticket_type_id, quantity, description
    from public.order_items where order_id = v_order.id
  loop
    update public.ticket_types
    set quantity_reserved = greatest(0, quantity_reserved - v_item.quantity),
        quantity_sold = quantity_sold + v_item.quantity
    where id = v_item.ticket_type_id
      and quantity_reserved >= v_item.quantity;
    if not found then
      raise exception using errcode = 'P0001', message = 'ticket reservation is no longer valid';
    end if;

    insert into public.ticket_instances(order_id,ticket_type_id,event_id,attendee_id,qr_token,status)
    select v_order.id, v_item.ticket_type_id, v_order.event_id, v_order.attendee_id,
           gen_random_uuid()::text, 'valid'
    from generate_series(1, v_item.quantity);

    v_ticket_count := v_ticket_count + v_item.quantity;
  end loop;

  update public.orders set status = 'paid', hold_expires_at = null where id = v_order.id;
  update public.payments
  set status = 'succeeded',
      provider_receipt = p_receipt,
      provider_response = coalesce(p_provider_event, '{}'::jsonb),
      paid_at = now()
  where id = v_payment.id;

  if v_profile.email is not null then
    insert into public.email_outbox(event_type,recipient,payload)
    values (
      'ticket_purchase_confirmation',
      v_profile.email,
      jsonb_build_object(
        'attendeeName', v_profile.name,
        'eventTitle', v_event.title,
        'eventDate', v_event.event_date,
        'eventTime', v_event.event_time,
        'eventLocation', v_event.location,
        'eventCity', v_event.city,
        'orderId', v_order.id,
        'ticketCount', v_ticket_count
      )
    );
  end if;

  return jsonb_build_object('success', true, 'replayed', false, 'order_id', v_order.id, 'tickets_issued', v_ticket_count);
end;
$$;

revoke all on function public.complete_mpesa_order_payment(text,text,numeric,text,jsonb) from public, anon, authenticated;
grant execute on function public.complete_mpesa_order_payment(text,text,numeric,text,jsonb) to service_role;

create or replace function public.fail_mpesa_order_payment(
  p_checkout_request_id text,
  p_reason text,
  p_provider_event jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_payment
  from public.payments
  where provider = 'mpesa' and provider_checkout_id = p_checkout_request_id
  for update;
  if not found then return false; end if;
  if v_payment.status in ('succeeded','refunded','partially_refunded') then return false; end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_order.status <> 'pending' then return false; end if;

  for v_item in select ticket_type_id, quantity from public.order_items where order_id = v_order.id loop
    update public.ticket_types
    set quantity_reserved = greatest(0, quantity_reserved - v_item.quantity)
    where id = v_item.ticket_type_id;
  end loop;

  update public.orders set status = 'failed', hold_expires_at = null where id = v_order.id;
  update public.payments
  set status = 'failed',
      failure_message = left(coalesce(p_reason, 'Payment failed'), 500),
      provider_response = coalesce(p_provider_event, '{}'::jsonb)
  where id = v_payment.id;
  return true;
end;
$$;

revoke all on function public.fail_mpesa_order_payment(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.fail_mpesa_order_payment(text,text,jsonb) to service_role;

-- The outbox worker claims rows in short batches and can safely retry after a crash.
create or replace function public.claim_email_outbox(p_batch_size integer default 25)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select id
    from public.email_outbox
    where status in ('pending','failed')
      and available_at <= now()
      and attempts < 8
      and (status <> 'processing' or locked_at < now() - interval '5 minutes')
    order by created_at
    limit least(greatest(p_batch_size, 1), 100)
    for update skip locked
  )
  update public.email_outbox e
  set status = 'processing', locked_at = now(), attempts = attempts + 1
  from candidates c
  where e.id = c.id
  returning e.*;
$$;
revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;
