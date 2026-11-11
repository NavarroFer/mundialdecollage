// Tries 20261112120000_community_posts.sql (docs/red-social.md §12): the feed,
// likes, comments, reports, the daily limit, the cursor, official posts and
// the pinned prompt. The migration is applied twice. Then the same rows are
// read as anon, as a signed-in artist, as an admin and as service_role.
//
//   npm install --no-save @electric-sql/pglite && node scripts/pglite/community.mjs
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261112120000_community_posts.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const ADMIN_EMAIL = 'mundialdecollage@gmail.com'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const A = id(1) // public artist, posts an obra
const B = id(2) // public artist, likes and comments
const C = id(3) // private profile
const D = id(4) // admin
const E = id(5) // second admin, so notify_admins has both
const R1 = id(6)
const R2 = id(7)
const R3 = id(8)
const RATE = id(9)
const CURSOR = id(10)
const PHOTO = id(11)
const ART = id(20) // A's obra
const ART_ARCHIVED = id(21)
const ART_PRIVATE = id(22)

const failures = []
function check(name, ok, detail = '') {
  if (ok) console.log('ok ', name)
  else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`)
    console.log('FAIL', name, detail)
  }
}

const db = await boot()
const failed = await applyMigrations(db, FILE)
const unexpected = failed.filter(([file]) => !KNOWN.has(file))
check('earlier migrations apply', unexpected.length === 0, unexpected.map(([file, message]) => `${file} => ${message}`).join('; '))

await db.exec(`
  insert into auth.users (id, email) values
    ('${A}', 'a@x.invalid'),
    ('${B}', 'b@x.invalid'),
    ('${C}', 'c@x.invalid'),
    ('${D}', '${ADMIN_EMAIL}'),
    ('${E}', 'fernando.navarro.mdp@gmail.com'),
    ('${R1}', 'r1@x.invalid'),
    ('${R2}', 'r2@x.invalid'),
    ('${R3}', 'r3@x.invalid'),
    ('${RATE}', 'rate@x.invalid'),
    ('${CURSOR}', 'cursor@x.invalid'),
    ('${PHOTO}', 'photo@x.invalid');
  insert into public.profiles (id, name, country_code, is_public, onboarded_at) values
    ('${A}', 'Ana Pérez', 'AR', true, now()),
    ('${B}', 'Marta López', 'UY', true, now()),
    ('${C}', 'Privado', 'AR', false, now()),
    ('${D}', 'Admin', 'AR', false, now()),
    ('${E}', 'Admin dos', 'AR', false, now()),
    ('${R1}', 'Uno', 'AR', true, now()),
    ('${R2}', 'Dos', 'AR', true, now()),
    ('${R3}', 'Tres', 'AR', true, now()),
    ('${RATE}', 'Rate', 'AR', true, now()),
    ('${CURSOR}', 'Cursor', 'AR', true, now()),
    ('${PHOTO}', 'Foto', 'AR', true, now());
  insert into public.artworks (id, profile_id, title, slug, image_url, is_selected) values
    ('${ART}', '${A}', 'Recortes', 'recortes', 'https://x.supabase.co/storage/v1/object/public/artworks/${A}/obra.jpg', true),
    ('${ART_ARCHIVED}', '${A}', 'Vieja', 'vieja', 'https://x.supabase.co/storage/v1/object/public/artworks/${A}/vieja.jpg', true),
    ('${ART_PRIVATE}', '${C}', 'Oculta', 'oculta', 'https://x.supabase.co/storage/v1/object/public/artworks/${C}/oculta.jpg', true);
  update public.artworks set archived_at = now() where id = '${ART_ARCHIVED}';
  -- New profiles are forced public (protect_profile_visibility) unless the
  -- writer is an admin. Hide these the way /admin/obras does.
  select set_config('request.jwt.claims', '{"email":"${ADMIN_EMAIL}"}', false);
  update public.profiles set is_public = false where id in ('${C}', '${D}', '${E}');
  select set_config('request.jwt.claims', '', false);
`)

const sql = readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql)
check('migration applies twice', true)

async function q(text, params) {
  const result = await db.query(text, params)
  return result.rows
}
async function fails(text) {
  try {
    await db.exec(text)
    return null
  } catch (error) {
    return String(error.message).split('\n')[0]
  }
}

// 1. An artist posts their obra; the feed returns it. Posting it again fails.
const posted = await q(`
  insert into public.posts (profile_id, kind, artwork_id, body)
  values ('${A}', 'artwork', '${ART}', 'Mi obra')
  returning id`)
const artworkPost = posted[0].id
const feed = await q(`select id, kind, artwork_slug, author_name from public.community_feed() where id = '${artworkPost}'`)
check('obra is in the feed', feed.length === 1 && feed[0].artwork_slug === 'recortes' && feed[0].author_name === 'Ana Pérez', JSON.stringify(feed))
const second = await fails(`insert into public.posts (profile_id, kind, artwork_id) values ('${A}', 'artwork', '${ART}')`)
check('the same obra cannot be posted twice', second?.includes('posts_artwork_once') ?? false, second)

// 2. A private profile and an archived obra stay out of the feed.
await db.exec(`
  insert into public.posts (profile_id, kind, artwork_id, body) values ('${C}', 'artwork', '${ART_PRIVATE}', 'no');
  insert into public.posts (profile_id, kind, artwork_id, body) values ('${A}', 'artwork', '${ART_ARCHIVED}', 'archivo');
`)
const hiddenFromFeed = await q(`select id from public.community_feed() where profile_id = '${C}' or artwork_slug = 'vieja'`)
check('private profile and archived obra stay out', hiddenFromFeed.length === 0, JSON.stringify(hiddenFromFeed))

// 3. A like from someone else counts and writes one post_activity for the day.
//    A second like the same day updates that row. The author liking their own
//    post does not notify. Removing a like subtracts.
await db.exec(`insert into public.post_likes (post_id, user_id) values ('${artworkPost}', '${B}')`)
let activity = await q(`select data from public.notifications where user_id = '${A}' and type = 'post_activity'`)
check('a like notifies the author once', activity.length === 1 && activity[0].data.likes === 1 && activity[0].data.lastName === 'Marta', JSON.stringify(activity))
await db.exec(`
  update public.profiles set name = 'Juan Pérez' where id = '${R1}';
  insert into public.post_likes (post_id, user_id) values ('${artworkPost}', '${R1}');
`)
activity = await q(`select data from public.notifications where user_id = '${A}' and type = 'post_activity'`)
check('a second like the same day updates the same notice', activity.length === 1 && activity[0].data.likes === 2 && activity[0].data.lastName === 'Juan', JSON.stringify(activity))
const beforeSelf = (await q(`select count(*)::int as n from public.notifications where type = 'post_activity'`))[0].n
await db.exec(`insert into public.post_likes (post_id, user_id) values ('${artworkPost}', '${A}')`)
const afterSelf = (await q(`select count(*)::int as n from public.notifications where type = 'post_activity'`))[0].n
check('the author liking their own post does not notify', afterSelf === beforeSelf)
await db.exec(`delete from public.post_likes where post_id = '${artworkPost}' and user_id = '${A}'`)
const likes = (await q(`select like_count from public.posts where id = '${artworkPost}'`))[0].like_count
check('removing a like subtracts', likes === 2, String(likes))

// 4. An approved comment counts. A pending one does not, and tells the admins.
//    Approving it counts and tells the commenter. Rejecting an approved one subtracts.
await db.exec(`insert into public.post_comments (post_id, user_id, author_name, body, status) values ('${artworkPost}', '${B}', 'Marta López', 'Hermoso', 'approved')`)
let comments = (await q(`select comment_count from public.posts where id = '${artworkPost}'`))[0].comment_count
check('an approved comment counts', comments === 1, String(comments))
await db.exec(`insert into public.post_comments (post_id, user_id, author_name, author_email, body, status) values ('${artworkPost}', '${R2}', 'Dos', 'r2@x.invalid', 'Espero', 'pending')`)
comments = (await q(`select comment_count from public.posts where id = '${artworkPost}'`))[0].comment_count
const pendingNotice = await q(`select data from public.notifications where type = 'post_comments_pending' and admin`)
check('a pending comment does not count and tells the admins', comments === 1 && pendingNotice.length === 2 && pendingNotice[0].data.count === 1, JSON.stringify(pendingNotice))
const pendingId = (await q(`select id from public.post_comments where body = 'Espero'`))[0].id
await db.exec(`update public.post_comments set status = 'approved' where id = '${pendingId}'`)
comments = (await q(`select comment_count from public.posts where id = '${artworkPost}'`))[0].comment_count
const approvedNotice = await q(`select type from public.notifications where user_id = '${R2}' and type = 'post_comment_approved'`)
check('approving a comment counts and tells its author', comments === 2 && approvedNotice.length === 1, String(comments))
await db.exec(`update public.post_comments set status = 'rejected' where id = '${pendingId}'`)
comments = (await q(`select comment_count from public.posts where id = '${artworkPost}'`))[0].comment_count
check('rejecting an approved comment subtracts', comments === 1, String(comments))

// 5. Three reports from different people hide the post. A fourth from the same person does not insert.
const reported = (await q(`
  insert into public.posts (profile_id, kind, image_path, body)
  values ('${PHOTO}', 'photo', '${PHOTO}/report.jpg', 'para denunciar')
  returning id`))[0].id
await db.exec(`
  insert into public.post_reports (post_id, user_id, reason) values
    ('${reported}', '${R1}', 'spam'),
    ('${reported}', '${R2}', 'spam'),
    ('${reported}', '${R3}', 'spam');
`)
const hidden = (await q(`select status, report_count from public.posts where id = '${reported}'`))[0]
check('three reports hide the post', hidden.status === 'hidden' && hidden.report_count === 3, JSON.stringify(hidden))
const duplicate = await fails(`insert into public.post_reports (post_id, user_id) values ('${reported}', '${R1}')`)
check('the same person cannot report twice', duplicate?.includes('duplicate') || duplicate?.includes('unique') || false, duplicate)
const reportNotice = await q(`select data from public.notifications where type = 'post_reported' and admin limit 1`)
check('a report tells the admins', reportNotice.length === 1 && reportNotice[0].data.reports === 3, JSON.stringify(reportNotice))

// 6. The sixth post in 24 hours fails. An admin has no limit.
for (let i = 0; i < 5; i += 1) {
  await db.exec(`insert into public.posts (profile_id, kind, image_path) values ('${RATE}', 'photo', '${RATE}/${i}.jpg')`)
}
const sixth = await fails(`insert into public.posts (profile_id, kind, image_path) values ('${RATE}', 'photo', '${RATE}/6.jpg')`)
check('the sixth post in a day is rate limited', sixth?.includes('rate_limited') ?? false, sixth)
for (let i = 0; i < 6; i += 1) {
  await db.exec(`insert into public.posts (profile_id, kind, image_path, official) values ('${D}', 'photo', '${D}/extra-${i}.jpg', false)`)
}
check('an admin posts without a limit', true)

// 8. A pending photo is not in the feed. Publishing it shows it and tells the author.
const pendingPhoto = (await q(`
  insert into public.posts (profile_id, kind, image_path, status)
  values ('${PHOTO}', 'photo', '${PHOTO}/pending.jpg', 'pending')
  returning id`))[0].id
const pendingFeed = await q(`select id from public.community_feed() where id = '${pendingPhoto}'`)
check('a pending photo stays out of the feed', pendingFeed.length === 0)
const pendingAdmins = await q(`select data from public.notifications where type = 'posts_pending' and admin limit 1`)
check('a pending photo tells the admins', pendingAdmins.length === 1 && pendingAdmins[0].data.count >= 1, JSON.stringify(pendingAdmins))
await db.exec(`update public.posts set status = 'published' where id = '${pendingPhoto}'`)
const published = await q(`select id from public.community_feed() where id = '${pendingPhoto}'`)
const approved = await q(`select data from public.notifications where user_id = '${PHOTO}' and type = 'post_approved'`)
check('publishing a photo shows it and tells the author', published.length === 1 && approved.length === 1, JSON.stringify(approved))

// 9. An official post from a profile that is not public is in the feed.
const official = (await q(`
  insert into public.posts (profile_id, kind, image_path, body, official)
  values ('${D}', 'photo', '${D}/official.jpg', 'Bienvenida', true)
  returning id`))[0].id
const officialFeed = await q(`select id, official, author_name from public.community_feed() where id = '${official}'`)
check('an official post from a private profile is in the feed', officialFeed.length === 1 && officialFeed[0].official === true, JSON.stringify(officialFeed))

// 10. Pinning a second post clears the first. Highlights: pinned, then the most
//     answered of the last 14 days, and an old post with many likes last.
const recentQuiet = (await q(`
  insert into public.posts (profile_id, kind, image_path, body, created_at)
  values ('${B}', 'photo', '${B}/quiet.jpg', 'quieta', now() - interval '1 hour')
  returning id`))[0].id
const recentTalked = (await q(`
  insert into public.posts (profile_id, kind, image_path, body, created_at)
  values ('${B}', 'photo', '${B}/talked.jpg', 'hablada', now() - interval '2 hours')
  returning id`))[0].id
const oldPopular = (await q(`
  insert into public.posts (profile_id, kind, image_path, body, created_at)
  values ('${B}', 'photo', '${B}/old.jpg', 'vieja', now() - interval '20 days')
  returning id`))[0].id
await db.exec(`
  update public.posts set like_count = 100 where id = '${oldPopular}';
  insert into public.post_comments (post_id, user_id, author_name, body, status) values
    ('${recentTalked}', '${R1}', 'Uno', 'uno', 'approved'),
    ('${recentTalked}', '${R2}', 'Dos', 'dos', 'approved'),
    ('${recentTalked}', '${R3}', 'Tres', 'tres', 'approved');
`)
await db.exec(`update public.posts set pinned_until = now() + interval '7 days' where id = '${recentQuiet}'`)
await db.exec(`update public.posts set pinned_until = now() + interval '7 days' where id = '${official}'`)
const pins = await q(`select id from public.posts where pinned_until is not null`)
check('pinning a second post clears the first', pins.length === 1 && pins[0].id === official, JSON.stringify(pins))
const highlights = await q(`select id, pinned from public.community_highlights(20)`)
const order = highlights.map((row) => row.id)
const rank = (post) => order.indexOf(post)
check(
  'highlights put the pinned post first, then the most answered, and the old one last',
  highlights[0]?.id === official && highlights[0]?.pinned === true
    && rank(recentTalked) > -1 && rank(recentQuiet) > rank(recentTalked) && rank(oldPopular) > rank(recentQuiet),
  order.map((post) => post.slice(0, 8)).join(','),
)

// 7. Cursor: 25 posts, page 1 returns 20 and page 2 the other 5, with no repeat.
//    Dated in the past so they don't trip the daily limit or crowd the strip.
for (let i = 0; i < 25; i += 1) {
  await db.exec(`insert into public.posts (profile_id, kind, image_path, created_at) values ('${CURSOR}', 'photo', '${CURSOR}/${i}.jpg', now() - interval '3 days' + interval '${i} minutes')`)
}
const page1 = await q(`select id, created_at from public.community_feed(null, null, '${CURSOR}', 20)`)
const last = page1[page1.length - 1]
const page2 = await q(`select id from public.community_feed('${last.created_at.toISOString()}', '${last.id}', '${CURSOR}', 20)`)
const ids = new Set([...page1.map((row) => row.id), ...page2.map((row) => row.id)])
check('the cursor pages 20 then 5 without repeating', page1.length === 20 && page2.length === 5 && ids.size === 25, `${page1.length}+${page2.length}`)

// 11. lastName is the first name of whoever answered last (covered with Juan above).
check('lastName keeps the first name of the latest reply', activity[0].data.lastName === 'Juan')

// A single post, including one that was hidden.
const one = await q(`select id from public.community_post('${artworkPost}')`)
const gone = await q(`select id from public.community_post('${reported}')`)
check('community_post returns a published post and skips a hidden one', one.length === 1 && gone.length === 0)

// Deleting (removed) frees the obra so it can be posted again, and does not notify.
await db.exec(`update public.posts set status = 'removed' where id = '${artworkPost}'`)
const hiddenNotice = await q(`select id from public.notifications where user_id = '${A}' and type = 'post_hidden'`)
const again = await q(`insert into public.posts (profile_id, kind, artwork_id) values ('${A}', 'artwork', '${ART}') returning id`)
check('removing a post frees the obra and does not notify', again.length === 1 && hiddenNotice.length === 0)
await db.exec(`update public.posts set status = 'hidden', moderated_at = now() where id = '${again[0].id}'`)
const hiddenByAdmin = await q(`select data from public.notifications where user_id = '${A}' and type = 'post_hidden'`)
check('an admin hiding a post notifies its author', hiddenByAdmin.length === 1 && hiddenByAdmin[0].data.kind === 'artwork', JSON.stringify(hiddenByAdmin))

// Roles. Storage RLS is on in Supabase; the harness leaves it off, so turn it
// on here and grant what Supabase grants, then check the policies this migration adds.
await db.exec(`
  -- Supabase grants usage on storage; the harness only grants public and auth.
  grant usage on schema storage to anon, authenticated, service_role;
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
`)

async function as(role, uid, email, text) {
  const claims = JSON.stringify({ sub: uid ?? '', email: email ?? '', role }).replaceAll("'", "''")
  await db.exec(`
    select set_config('request.jwt.claims', '${claims}', false);
    select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
    set role ${role};
  `)
  try {
    const result = await db.query(text)
    return { rows: result.rows }
  } catch (error) {
    return { error: String(error.message).split('\n')[0] }
  } finally {
    await db.exec('reset role')
  }
}

const anonRead = await as('anon', null, null, 'select id from public.posts')
check('anon cannot read posts', Boolean(anonRead.error), anonRead.error)
const artistRead = await as('authenticated', A, 'a@x.invalid', 'select id from public.posts')
check('an artist cannot read posts (service role does)', !artistRead.error && artistRead.rows.length === 0, JSON.stringify(artistRead))
const artistInsert = await as('authenticated', A, 'a@x.invalid', `insert into public.posts (profile_id, kind, image_path) values ('${A}', 'photo', '${A}/nope.jpg')`)
check('an artist cannot insert a post directly', Boolean(artistInsert.error), artistInsert.error)
const adminRead = await as('authenticated', D, ADMIN_EMAIL, 'select count(*)::int as n from public.posts')
check('an admin reads posts through RLS', !adminRead.error && adminRead.rows[0]?.n > 0, JSON.stringify(adminRead))
const anonFeed = await as('anon', null, null, 'select * from public.community_feed()')
check('anon cannot call the feed', Boolean(anonFeed.error), anonFeed.error)
const artistFeed = await as('authenticated', A, 'a@x.invalid', 'select * from public.community_feed()')
check('an artist cannot call the feed', Boolean(artistFeed.error), artistFeed.error)
const serviceFeed = await as('service_role', null, null, `select id from public.community_post('${official}')`)
check('service_role reads one post', !serviceFeed.error && serviceFeed.rows.length === 1, JSON.stringify(serviceFeed))
// No RETURNING: the artist has no SELECT policy on the bucket (public URLs
// don't go through RLS), so RETURNING would be rejected even when the insert is allowed.
const ownUpload = await as('authenticated', A, 'a@x.invalid', `insert into storage.objects (bucket_id, name) values ('posts', '${A}/foto.jpg')`)
const ownRow = await q(`select name from storage.objects where bucket_id = 'posts' and name = '${A}/foto.jpg'`)
check('an artist uploads only into their own folder', !ownUpload.error && ownRow.length === 1, JSON.stringify(ownUpload))
const otherUpload = await as('authenticated', A, 'a@x.invalid', `insert into storage.objects (bucket_id, name) values ('posts', '${B}/foto.jpg')`)
check("an artist cannot upload into someone else's folder", Boolean(otherUpload.error), otherUpload.error)
const adminUpload = await as('authenticated', D, ADMIN_EMAIL, `insert into storage.objects (bucket_id, name) values ('posts', '${D}/oficial.jpg')`)
const adminRow = await q(`select name from storage.objects where bucket_id = 'posts' and name = '${D}/oficial.jpg'`)
check('an admin uploads anywhere in the posts bucket', !adminUpload.error && adminRow.length === 1, JSON.stringify(adminUpload))

if (failures.length) {
  console.log(`\n${failures.length} failed`)
  for (const failure of failures) console.log(' -', failure)
  process.exit(1)
}
console.log('\ncommunity migration ok')
