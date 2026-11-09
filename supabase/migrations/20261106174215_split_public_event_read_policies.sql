-- Keep anonymous public reads independent from private authorization helpers.
drop policy if exists events_read_published_or_owner on public.events;
create policy events_public_read_published
  on public.events for select to anon
  using (status = 'published');
create policy events_authenticated_read_published_or_owner
  on public.events for select to authenticated
  using (
    status = 'published'
    or organizer_id = (select auth.uid())
    or (select private.has_role(array['admin']))
  );

-- Ticket type reads use the same public-vs-authenticated policy separation.
drop policy if exists ticket_types_read_published_or_manager on public.ticket_types;
create policy ticket_types_public_read_published
  on public.ticket_types for select to anon
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )
  );
create policy ticket_types_authenticated_read_published_or_manager
  on public.ticket_types for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and (
          e.status = 'published'
          or e.organizer_id = (select auth.uid())
          or (select private.has_role(array['admin']))
        )
    )
  );
