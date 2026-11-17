// Every obra an artist paid to postulate is public (20261117120000): the
// representative one and the other entered ones, for an artist who paid.
// A stale is_entered on a free artist's obra stays hidden. The migration
// enters all of a paying artist's obras when they fit in what was paid for.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261117120000_paid_entries_on_show.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const PAID = '00000000-0000-4000-8000-0000000000a1'
const FREE = '00000000-0000-4000-8000-0000000000b1'
const MANY = '00000000-0000-4000-8000-0000000000d1'
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) console.log('ok ', name)
  else { failures.push(`${name} ${detail}`); console.log('FAIL', name, detail) }
}

const db = await boot()
const failed = await applyMigrations(db, FILE)
const unexpected = failed.filter(([file]) => !KNOWN.has(file))
check('earlier migrations apply', unexpected.length === 0, unexpected.map(([file, message]) => `${file} => ${message}`).join('; '))

const obra = (profile, slug, { selected = false, entered = false, archived = false, image = true } = {}) =>
  `('${profile}', '${slug}', '${slug}', ${image ? `'https://x.invalid/${slug}.jpg'` : 'null'}, ${selected}, ${entered}, ${archived ? 'now()' : 'null'})`
await db.exec(`
  insert into auth.users (id, email) values ('${PAID}', 'paid@x.invalid'), ('${FREE}', 'free@x.invalid'), ('${MANY}', 'many@x.invalid');
  insert into public.profiles (id, name, is_public, country_code) values
    ('${PAID}', 'Paga', true, 'AR'), ('${FREE}', 'Gratis', true, 'UY'), ('${MANY}', 'Muchas', true, 'CL');
  insert into public.entry_purchases (user_id, email, provider, amount, currency, entries_allowed, status) values
    ('${PAID}', 'paid@x.invalid', 'mercadopago', 30000, 'ARS', 5, 'paid'),
    ('${MANY}', 'many@x.invalid', 'mercadopago', 30000, 'ARS', 5, 'paid'),
    ('${FREE}', 'free@x.invalid', 'mercadopago', 30000, 'ARS', 5, 'pending');
  insert into public.artworks (profile_id, title, slug, image_url, is_selected, is_entered, archived_at) values
    ${obra(PAID, 'paga-1', { selected: true })},
    ${obra(PAID, 'paga-2', { entered: true })},
    ${obra(PAID, 'paga-3')},
    ${obra(PAID, 'paga-archivada', { entered: true, archived: true })},
    ${obra(FREE, 'gratis-1', { selected: true })},
    ${obra(FREE, 'gratis-oculta', { entered: true })},
    ${obra(MANY, 'muchas-1', { selected: true })},
    ${obra(MANY, 'muchas-2', { entered: true })},
    ${obra(MANY, 'muchas-3')}, ${obra(MANY, 'muchas-4')}, ${obra(MANY, 'muchas-5')}, ${obra(MANY, 'muchas-6')};
`)

const sql = readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql) // safe to run twice

const entered = async (profile) => (await db.query(`select slug from public.artworks where profile_id = '${profile}' and is_entered order by slug`)).rows.map((r) => r.slug).join(',')
check('a paying artist gets every obra entered', (await entered(PAID)) === 'paga-1,paga-2,paga-3,paga-archivada', await entered(PAID))
check('more obras than paid for: their own choice stays', (await entered(MANY)) === 'muchas-1,muchas-2', await entered(MANY))
check('a free artist is left alone', (await entered(FREE)) === 'gratis-1,gratis-oculta', await entered(FREE))

async function asRole(role, sub, query) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${JSON.stringify({ role, sub })}', false); select set_config('request.jwt.claim.sub', '${sub ?? ''}', false);`)
  try { return (await db.query(query)).rows } finally { await db.exec('reset role') }
}
const anonSlugs = (await asRole('anon', null, `select slug from public.artworks order by slug`)).map((r) => r.slug).join(',')
check('anon sees every paid obra, not the archived one, not the hidden free one',
  anonSlugs === 'gratis-1,muchas-1,muchas-2,paga-1,paga-2,paga-3', anonSlugs)
const ownSlugs = (await asRole('authenticated', FREE, `select slug from public.artworks where profile_id = '${FREE}' order by slug`)).map((r) => r.slug).join(',')
check('the free artist still reads their own hidden obra', ownSlugs === 'gratis-1,gratis-oculta', ownSlugs)

const feed = (await db.query(`select slug from public.obra_activity_feed(null, null, 20)`)).rows.map((r) => r.slug).sort().join(',')
check('the activity feed lists the paid extras', feed === 'gratis-1,muchas-1,muchas-2,paga-1,paga-2,paga-3', feed)

await db.exec(`update public.artworks set tags = '{mar}'`)
const similar = (await db.query(`select slug from public.obra_similar('{mar}', 'paga-1', 12)`)).rows.map((r) => r.slug).sort().join(',')
check('similares include the paid extras', similar === 'gratis-1,muchas-1,muchas-2,paga-2,paga-3', similar)

const lineup = (await db.query(`select a.slug from public.ensure_exhibition_today() e join public.artworks a on a.id = e.artwork_id order by a.slug`)).rows.map((r) => r.slug).join(',')
check('the day in the 3D gallery can hang the paid extras', lineup === 'gratis-1,muchas-1,muchas-2,paga-1,paga-2,paga-3', lineup)

await db.query(`select public.like_gallery_artwork('paga-3', 'fan@x.invalid')`)
const likes = (await db.query(`select count(*)::int n from public.artwork_likes l join public.artworks a on a.id = l.artwork_id where a.slug = 'paga-3'`)).rows[0].n
check('a paid extra takes likes in the gallery', likes === 1, String(likes))
let refused = false
try { await db.query(`select public.like_gallery_artwork('gratis-oculta', 'fan@x.invalid')`) } catch { refused = true }
check('a hidden obra still refuses likes', refused)

const paga2 = (await db.query(`select id from public.artworks where slug = 'paga-2'`)).rows[0].id
const oculta = (await db.query(`select id from public.artworks where slug = 'gratis-oculta'`)).rows[0].id
await db.exec(`insert into public.posts (profile_id, kind, artwork_id, body, status) values
  ('${PAID}', 'artwork', '${paga2}', 'mi segunda', 'published'),
  ('${FREE}', 'artwork', '${oculta}', 'oculta', 'published')`)
const posts = (await db.query(`select artwork_slug from public.community_feed()`)).rows.map((r) => r.artwork_slug).join(',')
check('a post about a paid extra shows in the community; one about a hidden obra does not', posts === 'paga-2', posts)

if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('paid entries ok')
