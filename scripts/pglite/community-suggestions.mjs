// Tries 20261113180000_community_suggestions.sql (docs/red-social-explorar.md §7):
// obra_similar and community_suggested_artists.
//
//   npm install --no-save @electric-sql/pglite && node scripts/pglite/community-suggestions.mjs
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261113180000_community_suggestions.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const V = id(1) // the visitor, also an artist
const A = id(2) // mar + luz, the visitor has not answered
const B = id(3) // mar, the visitor liked it
const C = id(4) // ciudad only
const D = id(5) // no overlap
const E = id(6) // private profile
const O = (n) => id(20 + n)

const failures = []
const check = (name, ok, detail = '') => {
  if (ok) console.log('ok ', name)
  else { failures.push(`${name} ${detail}`); console.log('FAIL', name, detail) }
}

const db = await boot()
const failed = await applyMigrations(db, FILE)
const unexpected = failed.filter(([file]) => !KNOWN.has(file))
check('earlier migrations apply', unexpected.length === 0, unexpected.map(([file, message]) => `${file} => ${message}`).join('; '))
const sql = readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql)
check('migration applies twice', true)

// The visibility trigger resets is_public for non-admins; the test acts as one.
await db.exec('alter table public.profiles disable trigger profiles_protect_visibility')
await db.exec(`
  insert into auth.users (id, email) values
    ('${V}', 'v@x.invalid'), ('${A}', 'a@x.invalid'), ('${B}', 'b@x.invalid'),
    ('${C}', 'c@x.invalid'), ('${D}', 'd@x.invalid'), ('${E}', 'e@x.invalid');
  insert into public.profiles (id, name, is_public, country_code, onboarded_at) values
    ('${V}', 'Vera', true, 'AR', now()), ('${A}', 'Ana', true, 'AR', now()), ('${B}', 'Beto', true, 'UY', now()),
    ('${C}', 'Cleo', true, 'CL', now()), ('${D}', 'Dani', true, 'BR', now()), ('${E}', 'Eva', false, 'PE', now());
  insert into public.artworks (id, profile_id, title, slug, image_url, is_selected, tags) values
    ('${O(1)}', '${A}', 'Mar A', 'mar-a', 'https://x.invalid/1.jpg', true, '{mar}'),
    ('${O(2)}', '${A}', 'Mar y luz A', 'mar-luz-a', 'https://x.invalid/2.jpg', true, '{mar,luz}'),
    ('${O(3)}', '${B}', 'Mar B', 'mar-b', 'https://x.invalid/3.jpg', true, '{mar}'),
    ('${O(4)}', '${C}', 'Ciudad C', 'ciudad-c', 'https://x.invalid/4.jpg', true, '{ciudad}'),
    ('${O(5)}', '${D}', 'Otra D', 'otra-d', 'https://x.invalid/5.jpg', true, '{papel}'),
    ('${O(6)}', '${E}', 'Mar E', 'mar-e', 'https://x.invalid/6.jpg', true, '{mar}'),
    ('${O(7)}', '${V}', 'Mar V', 'mar-v', 'https://x.invalid/7.jpg', true, '{mar}'),
    ('${O(8)}', '${A}', 'Archivada', 'archivada', 'https://x.invalid/8.jpg', true, '{mar,luz,ciudad}');
  update public.artworks set archived_at = now() where id = '${O(8)}';
`)

// obra_similar
const similar = async (tags, skip = null) => (await db.query('select slug from public.obra_similar($1, $2, 6)', [tags, skip])).rows.map((row) => row.slug)
let rows = await similar(['mar', 'luz'], 'mar-a')
check('similar leaves out the obra itself', !rows.includes('mar-a'), rows.join(','))
check('similar ranks the most overlap first', rows[0] === 'mar-luz-a', rows.join(','))
check('similar skips private and archived', !rows.includes('mar-e') && !rows.includes('archivada'), rows.join(','))
check('similar with no tags returns nothing', (await similar([])).length === 0)

// community_suggested_artists
const suggested = async (visitor) => (await db.query('select * from public.community_suggested_artists($1, 6)', [visitor])).rows
check('no taste, no suggestions', (await suggested(V)).length === 0)
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${O(3)}', 'v@x.invalid', '${V}'),
    ('${O(1)}', 'v@x.invalid', '${V}'),
    ('${O(4)}', 'v@x.invalid', '${V}'),
    ('${O(5)}', 'v@x.invalid', '${V}'),
    ('${O(6)}', 'v@x.invalid', '${V}');
`)
// Liked B, A, C, D, E: all answered except V itself and nobody else is left.
check('answered artists are left out', (await suggested(V)).every((row) => ![B, A, C, D].includes(row.profile_id)), JSON.stringify(await suggested(V)))
await db.exec(`delete from public.artwork_likes where artwork_id in ('${O(1)}', '${O(4)}', '${O(5)}')`)
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${O(7)}', 'v@x.invalid', '${V}'),
    ('${O(2)}', 'w@x.invalid', null);
`)
// Taste now: mar and luz only (likes on B, E, V's own and two stamps).
await db.exec(`
  insert into public.artwork_stamp_collections (user_id, artwork_id) values ('${V}', '${O(1)}'), ('${V}', '${O(2)}');
`)
rows = await suggested(V)
check('taste produces suggestions', rows.length > 0, JSON.stringify(rows))
check('the visitor is not suggested to themselves', rows.every((row) => row.profile_id !== V))
check('an artist the visitor liked is left out', rows.every((row) => row.profile_id !== B))
check('one row per artist', new Set(rows.map((row) => row.profile_id)).size === rows.length)
check('private profiles are left out', rows.every((row) => row.profile_id !== E))
check('the best matching obra is the one suggested', rows.find((row) => row.profile_id === A)?.obra_slug === 'mar-a' || rows.find((row) => row.profile_id === A)?.obra_slug === 'mar-luz-a', JSON.stringify(rows))
check('artists with no overlap are left out', rows.every((row) => ![C, D].includes(row.profile_id)), JSON.stringify(rows))
check('only public columns come back', !('email' in (rows[0] ?? {})), Object.keys(rows[0] ?? {}).join(','))

// Opt-out wins.
await db.exec(`update public.profiles set personalize = false where id = '${V}'`)
check('personalize = false returns nothing', (await suggested(V)).length === 0)
check('a null visitor returns nothing', (await db.query('select * from public.community_suggested_artists(null, 6)')).rows.length === 0)

if (failures.length) { console.log(failures.join('\n')); process.exit(1) }
console.log('community suggestions ok')
