// The album's sixteen stamps (20261117140000_more_stamps.sql): each one comes
// from the table where it is earned, writes one notice, the backfill gives
// one summary notice, visitors can only write the two browser stamps, and
// the fifteenth brings the legend.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const before = await applyMigrations(db, '20261117140000_more_stamps.sql')
console.log('failed before:', before.map((f) => f[0]))

const A = '00000000-0000-4000-8000-00000000000a' // artist
const V = '00000000-0000-4000-8000-00000000000b' // visitor
const O = '00000000-0000-4000-8000-00000000000c' // old visitor (backfill)
const art = (n) => `a0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
const sess = (n) => `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
const voters = Array.from({ length: 12 }, (_, i) => `c0000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`)

await db.exec(`
  insert into auth.users(id,email) values ('${A}','a@x.invalid'),('${V}','v@x.invalid'),('${O}','o@x.invalid')
    ${voters.map((id, i) => `,('${id}','voter${i}@x.invalid')`).join('')};
  insert into public.profiles(id,name,country_code,is_public) values ('${A}','Ana','AR',true);
  insert into public.artworks(id,profile_id,slug,image_url,title,is_selected)
    select ('a0000000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid, '${A}', 'obra-' || g, 'u', 'Obra ' || g, true
    from generate_series(1, 30) g;
  -- The old visitor already did things before the stamps existed.
  insert into public.artwork_likes(artwork_id,email,user_id) values ('${art(1)}','o@x.invalid',null);
  insert into public.artwork_stamp_collections(user_id,artwork_id) values ('${O}','${art(1)}'),('${O}','${art(2)}');
`)

await db.exec(readFileSync(new URL('../../supabase/migrations/20261117140000_more_stamps.sql', import.meta.url), 'utf8'))

const q = async (sql) => (await db.query(sql)).rows
const stamps = async (uid) => (await q(`select stamp_key from public.profile_stamps where user_id='${uid}' order by stamp_key`)).map((r) => r.stamp_key).join(',')
const notices = async (uid) => (await q(`select type, data from public.notifications where user_id='${uid}' order by created_at, type`)).map((r) => `${r.type}${JSON.stringify(r.data)}`)

console.log('backfill old visitor       :', await stamps(O), await notices(O))

async function as(uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
console.log('visitor writes gallery     :', await as(V, `insert into public.profile_stamps(user_id,stamp_key) values ('${V}','gallery') returning stamp_key`))
console.log('visitor writes legend      :', await as(V, `insert into public.profile_stamps(user_id,stamp_key) values ('${V}','legend') returning stamp_key`))
console.log('visitor reads own notices  :', await as(V, `select type, data->>'stamp' as stamp from public.notifications`))

// Likes: first, then the tenth; the obra's tenth like gives its artist the applause.
for (let i = 1; i <= 10; i++) await db.exec(`insert into public.artwork_likes(artwork_id,email,user_id) values ('${art(i)}','v@x.invalid','${V}')`)
for (let i = 0; i < 9; i++) await db.exec(`insert into public.artwork_likes(artwork_id,email,user_id) values ('${art(1)}','voter${i}@x.invalid','${voters[i]}')`)
console.log('after 10 likes visitor     :', await stamps(V))
console.log('obra 1 has 10 likes artist :', await stamps(A))

// Saved obras: 1, 10, 25.
for (let i = 1; i <= 25; i++) await db.exec(`insert into public.artwork_stamp_collections(user_id,artwork_id) values ('${V}','${art(i)}')`)
console.log('after 25 saved             :', await stamps(V))

// Three different days in the gallery.
await db.exec(`insert into public.gallery_attention_sessions(id,user_id,created_at) values
  ('${sess(1)}','${V}', now() - interval '3 days'), ('${sess(2)}','${V}', now() - interval '3 days' + interval '1 hour')`)
console.log('two sessions, one day      :', (await stamps(V)).includes('regular'))
await db.exec(`insert into public.gallery_attention_sessions(id,user_id,created_at) values ('${sess(3)}','${V}', now() - interval '2 days'), ('${sess(4)}','${V}', now())`)
console.log('three days                 :', (await stamps(V)).includes('regular'))

// A comment counts once approved.
await db.exec(`insert into public.artwork_comments(id,artwork_id,user_id,author_name,body) values ('d0000000-0000-4000-8000-000000000001','${art(1)}','${V}','Vi','Linda')`)
console.log('comment pending            :', (await stamps(V)).includes('comment'))
await db.exec(`update public.artwork_comments set status='approved' where id='d0000000-0000-4000-8000-000000000001'`)
console.log('comment approved           :', (await stamps(V)).includes('comment'))

// Artist side: post, exhibition, referral.
await db.exec(`insert into public.posts(profile_id,kind,artwork_id) values ('${A}','artwork','${art(1)}')`)
await db.exec(`insert into public.exhibition_days(day,slot,artwork_id) values (current_date,0,'${art(2)}')`)
await db.exec(`insert into public.profiles(id,name,country_code) values ('${voters[11]}','Bea','UY'); insert into public.referrals(referred_id,referrer_id) values ('${voters[11]}','${A}')`)
console.log('artist                     :', await stamps(A))

console.log('visitor notices            :', (await notices(V)).length, 'unique keys:', new Set((await q(`select dedupe_key from public.notifications where user_id='${V}'`)).map((r) => r.dedupe_key)).size)
console.log('visitor count in last      :', (await notices(V)).at(-1))

// A like that fails to award must still be saved: break the helper and like.
await db.exec(`alter table public.profile_stamps rename to profile_stamps_x`)
await db.exec(`insert into public.artwork_likes(artwork_id,email,user_id) values ('${art(20)}','v@x.invalid','${V}')`).catch((e) => console.log('LIKE FAILED', e.message))
console.log('like saved with stamps off :', (await q(`select count(*)::int as n from public.artwork_likes where artwork_id='${art(20)}'`))[0].n)
await db.exec(`alter table public.profile_stamps_x rename to profile_stamps`)

// Legend: give the visitor every other stamp.
await db.exec(`insert into public.profile_stamps(user_id,stamp_key) select '${V}', k from unnest(array['world','wall','first','post','exhibited','ambassador','applause']) k on conflict do nothing`)
console.log('legend                     :', (await stamps(V)).split(',').length, (await stamps(V)).includes('legend'))
console.log('legend notice              :', (await notices(V)).filter((n) => n.includes('legend')))
