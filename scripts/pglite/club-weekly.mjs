// The Club's weekly summary (20261029220000): last week's numbers only,
// one note per gallery and week however many times the cron runs.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const M = '00000000-0000-4000-8000-000000000001', V = '00000000-0000-4000-8000-000000000002', N = '00000000-0000-4000-8000-000000000003'
const lastWeek = "(date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') - interval '3 days') at time zone 'America/Argentina/Buenos_Aires'"
const thisWeek = "now()"
await db.exec(`insert into auth.users(id,email) values ('${M}','m@x.invalid'),('${V}','v@x.invalid'),('${N}','n@x.invalid');
 insert into public.profiles(id,name,country_code) values ('${M}','Fer','AR');
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,courtesy_granted_at,created_at) values
   ('${M}','fer-g','Taller Fer','Female_Adult_01','active',now(), now() - interval '30 days'),
   ('${N}','new-g','Nueva','Female_Adult_01','active',now(), now());
 insert into public.artworks(id,profile_id,slug,image_url,title,is_club_only) values ('a0000000-0000-4000-8000-000000000001','${M}','c1','u','Uno',true);
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,1,'a0000000-0000-4000-8000-000000000001' from public.club_galleries where slug='fer-g';
 insert into public.artwork_likes(artwork_id,email,created_at) values ('a0000000-0000-4000-8000-000000000001','a@x.invalid',${lastWeek}),('a0000000-0000-4000-8000-000000000001','b@x.invalid',${thisWeek});
 insert into public.artwork_stamp_collections(user_id,artwork_id,collected_at) values ('${V}','a0000000-0000-4000-8000-000000000001',${lastWeek});
 insert into public.gallery_attention_sessions(id,user_id,created_at) values ('b0000000-0000-4000-8000-000000000001','${V}',${lastWeek});
 insert into public.gallery_attention(session_id,artwork_id,mode,milliseconds,episodes) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','view',5000,1);`)
const run = async (dry) => (await db.query('select public.club_weekly_summaries($1) as n', [dry])).rows[0].n
console.log('dry run                  :', await run(true), JSON.stringify((await db.query("select count(*) from public.notifications where type='club_weekly'")).rows))
console.log('first run                :', await run(false))
console.log('second run (same week)   :', await run(false))
console.log('notes                    :', JSON.stringify((await db.query("select user_id, dedupe_key like 'club_weekly:%' as weekly, data - 'week' as data from public.notifications where type='club_weekly'")).rows))
await db.exec('set role authenticated')
try { await db.query('select public.club_weekly_summaries(false)'); console.log('member calls it          : allowed?!') } catch (e) { console.log('member calls it          :', e.message.split('\n')[0]) }
await db.exec('reset role')
