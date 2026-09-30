-- Keep clicks and spam complaints separate from opens. Resend emits both
-- events, but a click used to be folded into an open, losing the campaign's
-- most useful conversion signal. Counters are unique-recipient metrics; a
-- recipient can click more than once without inflating a campaign's rate.
alter table public.campaign_sends
  add column if not exists clicked_at timestamptz,
  add column if not exists click_count integer not null default 0,
  add column if not exists complained_at timestamptz;

alter table public.campaigns
  add column if not exists clicked_count integer not null default 0,
  add column if not exists complained_count integer not null default 0;

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
  v_was_clicked boolean;
  v_was_bounced boolean;
  v_was_complained boolean;
begin
  select campaign_id, contact_id, delivered_at is not null, opened_at is not null,
         clicked_at is not null, bounced_at is not null, status = 'complained'
    into v_campaign_id, v_contact_id, v_was_delivered, v_was_opened,
         v_was_clicked, v_was_bounced, v_was_complained
    from public.campaign_sends
    where resend_email_id = p_resend_email_id
    for update;

  if v_campaign_id is null then return; end if;

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
          opened_at = coalesce(opened_at, p_occurred_at), open_count = open_count + 1
      where resend_email_id = p_resend_email_id;
    if not v_was_opened then
      update public.campaigns set opened_count = opened_count + 1 where id = v_campaign_id;
    end if;

  elsif p_event = 'clicked' then
    update public.campaign_sends
      set status = case when status in ('bounced', 'complained') then status else 'opened' end,
          opened_at = coalesce(opened_at, p_occurred_at),
          clicked_at = coalesce(clicked_at, p_occurred_at), click_count = click_count + 1
      where resend_email_id = p_resend_email_id;
    if not v_was_opened then
      update public.campaigns set opened_count = opened_count + 1 where id = v_campaign_id;
    end if;
    if not v_was_clicked then
      update public.campaigns set clicked_count = clicked_count + 1 where id = v_campaign_id;
    end if;

  elsif p_event = 'bounced' then
    update public.campaign_sends set status = 'bounced', bounced_at = coalesce(bounced_at, p_occurred_at)
      where resend_email_id = p_resend_email_id;
    if not v_was_bounced then
      update public.campaigns set bounced_count = bounced_count + 1 where id = v_campaign_id;
    end if;

  elsif p_event = 'complained' then
    update public.campaign_sends set status = 'complained', complained_at = coalesce(complained_at, p_occurred_at)
      where resend_email_id = p_resend_email_id;
    if not v_was_complained then
      update public.campaigns set complained_count = complained_count + 1 where id = v_campaign_id;
    end if;
    if v_contact_id is not null then
      update public.contacts set subscribed = false where id = v_contact_id;
    end if;
  end if;
end;
$$;
