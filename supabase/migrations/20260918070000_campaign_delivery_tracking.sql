-- campaign_sends previously only ever recorded 'sent' the instant Resend's
-- API call returned without throwing — which it never does; the Resend SDK
-- resolves { data, error } instead of rejecting, so real failures (bad API
-- key, unverified domain, invalid recipient) were silently logged as
-- successes. This adds the columns needed to (a) record genuine delivery
-- failures and (b) track delivery/opens via Resend's webhook, keyed by the
-- email id Resend returns from the send call.

alter table public.campaign_sends
  add column if not exists resend_email_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists bounced_at timestamptz;

create unique index if not exists campaign_sends_resend_email_id_idx
  on public.campaign_sends (resend_email_id)
  where resend_email_id is not null;

alter table public.campaign_sends drop constraint if exists campaign_sends_status_check;
alter table public.campaign_sends add constraint campaign_sends_status_check
  check (status in ('pending', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed'));

alter table public.campaigns
  add column if not exists delivered_count integer not null default 0,
  add column if not exists opened_count integer not null default 0,
  add column if not exists bounced_count integer not null default 0;

-- Applies one Resend webhook event to the matching campaign_sends row and
-- bumps the campaign's aggregate counters, but only the first time a given
-- row reaches that state. Webhooks can be redelivered (and Resend can fire
-- two events for the same row close together), so the initial SELECT takes
-- a row lock (`for update`) — a second call for the same email id blocks
-- until the first transaction commits, instead of both reading
-- opened_at as null and double-counting. A spam complaint also unsubscribes
-- the contact, same as the public unsubscribe link, to protect sender
-- reputation.
create or replace function public.record_resend_event(
  p_resend_email_id text,
  p_event text,
  p_occurred_at timestamptz
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_contact_id uuid;
  v_was_delivered boolean;
  v_was_opened boolean;
  v_was_bounced boolean;
begin
  select campaign_id, contact_id, delivered_at is not null, opened_at is not null, bounced_at is not null
    into v_campaign_id, v_contact_id, v_was_delivered, v_was_opened, v_was_bounced
    from public.campaign_sends
    where resend_email_id = p_resend_email_id
    for update;

  if v_campaign_id is null then
    return;
  end if;

  if p_event = 'delivered' then
    update public.campaign_sends
      set status = case when status in ('opened', 'bounced', 'complained') then status else 'delivered' end,
          delivered_at = coalesce(delivered_at, p_occurred_at)
      where resend_email_id = p_resend_email_id;
    if not v_was_delivered then
      update public.campaigns set delivered_count = delivered_count + 1 where id = v_campaign_id;
    end if;

  elsif p_event = 'opened' then
    update public.campaign_sends
      set status = case when status in ('bounced', 'complained') then status else 'opened' end,
          opened_at = coalesce(opened_at, p_occurred_at),
          open_count = open_count + 1
      where resend_email_id = p_resend_email_id;
    if not v_was_opened then
      update public.campaigns set opened_count = opened_count + 1 where id = v_campaign_id;
    end if;

  elsif p_event = 'bounced' then
    update public.campaign_sends
      set status = 'bounced',
          bounced_at = coalesce(bounced_at, p_occurred_at)
      where resend_email_id = p_resend_email_id;
    if not v_was_bounced then
      update public.campaigns set bounced_count = bounced_count + 1 where id = v_campaign_id;
    end if;

  elsif p_event = 'complained' then
    update public.campaign_sends set status = 'complained' where resend_email_id = p_resend_email_id;
    if v_contact_id is not null then
      update public.contacts set subscribed = false where id = v_contact_id;
    end if;
  end if;
end;
$$;
