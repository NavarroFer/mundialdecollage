// Tests contact normalization and system-sender handling in a transaction
// that is always rolled back.
// node --env-file=.env.local scripts/test-contact-sanitize-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  'supabase/migrations/20260922233000_normalize_contacts.sql',
  'utf8',
)
const query = `begin;
${migration}
insert into public.contacts(email, name, source, subscribed)
values('  NOREPLY-contact-sanitize-probe@example.com  ', 'Probe', 'test', true);
do $$
begin
  if not exists (
    select 1 from public.contacts
    where email = 'noreply-contact-sanitize-probe@example.com' and subscribed = false
  ) then
    raise exception 'System sender was not normalized and unsubscribed';
  end if;
  if exists (
    select 1 from public.contacts
    group by lower(trim(email)) having count(*) > 1
  ) then
    raise exception 'Normalized duplicate contacts remain';
  end if;
end $$;
select 'Contact sanitation tests passed' as result;
rollback;`

const response = await fetch(
  `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(45_000),
  },
)
const body = await response.text()
if (!response.ok) throw new Error(body)
console.log(body)
