// like_gallery_artwork() after 20261113190000: it keeps what 20261113140000 added
// (the account behind each like) and the Club rules from 20261029120000 that
// the first rewrite dropped (obras hung in an active Club gallery can be
// liked, and a new like earns one Club coin, once).
import { boot, applyMigrations } from './harness.mjs'

const db = await boot()
const failed = await applyMigrations(db)
// PGlite has no Realtime, so a few unrelated migrations fail here (the other
// scripts tolerate them). Only the ones this function depends on must apply.
const names = failed.map((f) => f[0])
console.log('failed (unrelated):', names)
if (names.some((n) => /^(20260922130000|20261029|20261113)/.test(n))) { console.log('A migration this test needs failed'); process.exit(1) }

const O = '00000000-0000-4000-8000-0000000000a1' // owner of the public obra
const M = '00000000-0000-4000-8000-0000000000a2' // Club member with an active gallery
const V = '00000000-0000-4000-8000-0000000000a3' // voter with an account
await db.exec(`insert into auth.users(id,email) values ('${O}','o@x.invalid'),('${M}','m@x.invalid'),('${V}','v@x.invalid');
  insert into public.profiles(id,name,country_code,is_public) values ('${O}','Owner','AR',true),('${M}','Member','UY',false),('${V}','Voter','BR',false);
  insert into public.artworks(profile_id,slug,image_url,title,is_selected) values ('${O}','pub','u','Public',true),('${O}','hidden','u','Hidden',false);
  insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,courtesy_granted_at)
    values ('${M}','member-g','Member','Female_Adult_01','active',now());
  insert into public.artworks(profile_id,slug,image_url,title,is_club_only) values ('${M}','club1','u','Club 1',true);
  insert into public.club_gallery_hangings(gallery_id,slot,artwork_id)
    select g.id, 1, a.id from public.club_galleries g, public.artworks a where a.slug = 'club1';`)

let bad = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) bad++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}
const like = async (slug, email, id = null) => {
  try { await db.query('select public.like_gallery_artwork($1,$2,$3)', [slug, email, id]); return 'ok' }
  catch (e) { return e.message.split('\n')[0] }
}
const rows = async (sql) => (await db.query(sql)).rows
const coins = async () => (await rows(`select coalesce(sum(delta),0)::int as n from public.coin_transactions where user_id = '${V}' and kind = 'activity'`))[0].n
const likeRow = async (slug) => rows(`select l.email, l.user_id from public.artwork_likes l join public.artworks a on a.id = l.artwork_id where a.slug = '${slug}' order by 1`)

check('public obra: like accepted', await like('pub', 'v@x.invalid', V), 'ok')
check('public obra: account stored in user_id', await likeRow('pub'), [{ email: 'v@x.invalid', user_id: V }])
check('public obra: first like earned one coin', await coins(), 1)
check('public obra: same like again accepted', await like('pub', 'v@x.invalid', V), 'ok')
check('public obra: same like again adds no row', (await likeRow('pub')).length, 1)
check('public obra: same like again adds no coin', await coins(), 1)

check('club obra in an active gallery: like accepted', await like('club1', 'v@x.invalid', V), 'ok')
check('club obra: like stored with the account', await likeRow('club1'), [{ email: 'v@x.invalid', user_id: V }])
check('club obra: a new like earns another coin', await coins(), 2)
check('club obra: repeating the like adds no coin', (await like('club1', 'v@x.invalid', V), await coins()), 2)

await db.exec("update public.club_galleries set status = 'paused'")
check('club obra in a paused gallery: rejected', await like('club1', 'x@x.invalid'), 'Artwork unavailable')
await db.exec("update public.club_galleries set status = 'active'")
check('obra that is neither selected nor hung: rejected', await like('hidden', 'x@x.invalid'), 'Artwork unavailable')
check('unknown slug: rejected', await like('nope', 'x@x.invalid'), 'Artwork unavailable')
check('malformed email: rejected', await like('pub', 'Not An Email'), 'Invalid email')

// Without a session id the account is found by email, as the Club version did.
await db.exec(`insert into public.artworks(profile_id,slug,image_url,title,is_selected) values ('${O}','pub2','u','Public 2',true)`)
check('two-argument call: accepted', await like('pub2', 'v@x.invalid'), 'ok')
check('two-argument call: coin found through the email', await coins(), 3)
check('two-argument call: user_id stays empty', await likeRow('pub2'), [{ email: 'v@x.invalid', user_id: null }])
check('later like with a session fills the empty user_id', (await like('pub2', 'v@x.invalid', V), await likeRow('pub2')), [{ email: 'v@x.invalid', user_id: V }])
check('later like with a session adds no coin', await coins(), 3)

// A voter without an account earns nothing but the like is recorded.
check('no-account voter: like accepted', await like('pub', 'ghost@x.invalid'), 'ok')
check('no-account voter: no coins credited to anyone else', (await rows("select count(*)::int as n from public.coin_transactions where kind = 'activity'"))[0].n, 3)

// The privileges stay as they were: service role only.
check('anon cannot execute', (await rows("select has_function_privilege('anon','public.like_gallery_artwork(text,text,uuid)','execute') as ok"))[0].ok, false)
check('authenticated cannot execute', (await rows("select has_function_privilege('authenticated','public.like_gallery_artwork(text,text,uuid)','execute') as ok"))[0].ok, false)
check('service_role can execute', (await rows("select has_function_privilege('service_role','public.like_gallery_artwork(text,text,uuid)','execute') as ok"))[0].ok, true)
check('only one overload remains', (await rows("select count(*)::int as n from pg_proc where proname = 'like_gallery_artwork'"))[0].n, 1)

console.log(bad ? `\n${bad} FAILED` : '\nall passed')
process.exit(bad ? 1 : 0)
