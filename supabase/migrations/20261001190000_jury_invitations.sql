-- Jury invitations and reminders (lib/jury-mail.ts). invited_at: when the
-- last invitation mail went out (null: never invited), shown in
-- /admin/jurado. reminded_on: the Argentina day of the last reminder before
-- the voting deadline; the daily cron claims it with a conditional update
-- before sending, so a juror gets at most one reminder per day.
alter table public.jurors
  add column if not exists invited_at timestamptz,
  add column if not exists reminded_on date;

notify pgrst, 'reload schema';
