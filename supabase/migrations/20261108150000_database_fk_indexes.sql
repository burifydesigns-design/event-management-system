-- Remove a redundant unique index: the existing UNIQUE(event_id, name)
-- constraint already provides the required index.
drop index if exists public.ticket_types_event_name_unique;

-- Cover foreign keys used in joins and parent-row deletes/updates.
create index if not exists events_venue_id_idx
  on public.events(venue_id);
create index if not exists event_sessions_venue_id_idx
  on public.event_sessions(venue_id);
create index if not exists order_items_ticket_type_id_idx
  on public.order_items(ticket_type_id);
create index if not exists venues_created_by_idx
  on public.venues(created_by);
