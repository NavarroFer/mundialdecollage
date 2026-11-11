// Tries 20261113140000_community_taste.sql (docs/red-social.md §11 ter):
// likes backfill, the personalization switch, and community_taste. The
// migration is applied twice, then once more after seeding to prove the
// email -> user_id backfill. Every scenario uses its own visitor so one case
// cannot leak interactions into another.
//
//   npm install --no-save @electric-sql/pglite && node scripts/pglite/community-taste.mjs
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261113140000_community_taste.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const A = id(1) // public artist, owns every obra
const V1 = id(2) // two likes
const V2 = id(3) // enough interactions, mixed signals
const V3 = id(4) // four likes + one pending comment
const V4 = id(5) // opted out
const V5 = id(6) // view vs details, same milliseconds
const V6 = id(7) // an old like vs today's
const V7 = id(8) // the same obra watched in two sessions

const AMAR = id(20)
const ALUZ = id(21)
const AMIX = id(22)
const AVIEW = id(23)
const ADET = id(24)
const AOLD = id(25)
const ANEW = id(26)
const AN1 = id(27) // untagged, only reaches the five-interaction floor
const AN2 = id(28)
const AN3 = id(29)
const S2 = id(40)
const S5 = id(41)
const S7A = id(42)
const S7B = id(43)

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

const sql = readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql)
check('migration applies twice', true)

// Empty tables: zero rows, no error.
const empty = await db.query(`select tag from public.community_taste('${id(99)}')`)
check('no interactions anywhere returns nothing', empty.rows.length === 0, JSON.stringify(empty.rows))

await db.exec(`
  insert into auth.users (id, email) values
    ('${A}', 'artist@x.invalid'),
    ('${V1}', 'v1@x.invalid'),
    ('${V2}', 'v2@x.invalid'),
    ('${V3}', 'v3@x.invalid'),
    ('${V4}', 'v4@x.invalid'),
    ('${V5}', 'v5@x.invalid'),
    ('${V6}', 'v6@x.invalid'),
    ('${V7}', 'v7@x.invalid');
  insert into public.profiles (id, name, is_public, onboarded_at, personalize) values
    ('${A}', 'Ana', true, now(), true),
    ('${V1}', 'Uno', true, now(), true),
    ('${V2}', 'Dos', true, now(), true),
    ('${V3}', 'Tres', true, now(), true),
    ('${V4}', 'Cuatro', true, now(), false),
    ('${V5}', 'Cinco', true, now(), true),
    ('${V6}', 'Seis', true, now(), true),
    ('${V7}', 'Siete', true, now(), true);
  insert into public.artworks (id, profile_id, title, slug, image_url, is_selected, tags) values
    ('${AMAR}', '${A}', 'Mar', 'mar', 'https://x.invalid/mar.jpg', true, '{mar}'),
    ('${ALUZ}', '${A}', 'Luz', 'luz', 'https://x.invalid/luz.jpg', true, '{luz}'),
    ('${AMIX}', '${A}', 'Mar y ciudad', 'mar-ciudad', 'https://x.invalid/mar-ciudad.jpg', true, '{mar,ciudad}'),
    ('${AVIEW}', '${A}', 'Vista', 'vista', 'https://x.invalid/vista.jpg', true, '{vista}'),
    ('${ADET}', '${A}', 'Detalle', 'detalle', 'https://x.invalid/detalle.jpg', true, '{detalle}'),
    ('${AOLD}', '${A}', 'Vieja', 'vieja', 'https://x.invalid/vieja.jpg', true, '{viejo}'),
    ('${ANEW}', '${A}', 'Nueva', 'nueva', 'https://x.invalid/nueva.jpg', true, '{nuevo}'),
    ('${AN1}', '${A}', 'Sin uno', 'sin-uno', 'https://x.invalid/sin-uno.jpg', true, '{}'),
    ('${AN2}', '${A}', 'Sin dos', 'sin-dos', 'https://x.invalid/sin-dos.jpg', true, '{}'),
    ('${AN3}', '${A}', 'Sin tres', 'sin-tres', 'https://x.invalid/sin-tres.jpg', true, '{}');

  -- A like cast before this migration: email only, no user_id.
  insert into public.artwork_likes (artwork_id, email) values ('${AMAR}', 'v1@x.invalid');
`)

// Re-running the migration now must backfill that legacy like.
await db.exec(sql)
const backfilled = (await db.query(`select user_id from public.artwork_likes where artwork_id = '${AMAR}' and email = 'v1@x.invalid'`)).rows[0]?.user_id
check('legacy like gets user_id from its email', backfilled === V1, String(backfilled))

const taste = async (visitor) => (await db.query('select tag, weight from public.community_taste($1)', [visitor])).rows

// Case 1: two likes are not enough to read a taste.
await db.exec(`insert into public.artwork_likes (artwork_id, email, user_id) values ('${ALUZ}', 'v1@x.invalid', '${V1}')`)
const few = await taste(V1)
check('fewer than five interactions returns nothing', few.length === 0, JSON.stringify(few))

// Case 2: likes + approved comment + stamp + attention in one taste.
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${AMAR}', 'v2@x.invalid', '${V2}'),
    ('${ALUZ}', 'v2@x.invalid', '${V2}'),
    ('${AMIX}', 'v2@x.invalid', '${V2}');
  insert into public.artwork_comments (artwork_id, user_id, author_name, body, status)
    values ('${AMAR}', '${V2}', 'Dos', 'me gusta', 'approved');
  insert into public.artwork_stamp_collections (user_id, artwork_id) values ('${V2}', '${ALUZ}');
  insert into public.gallery_attention_sessions (id, user_id) values ('${S2}', '${V2}');
  insert into public.gallery_attention (session_id, artwork_id, mode, milliseconds, episodes)
    values ('${S2}', '${AMAR}', 'view', 30000, 1);
`)
const mixed = await taste(V2)
check('five or more interactions produce a taste', mixed.length > 0 && mixed.length <= 10, JSON.stringify(mixed))
check('the strongest tag is normalized to 1', mixed[0]?.weight === 1, String(mixed[0]?.weight))
check('tags are ordered by weight desc', mixed.every((row, i) => i === 0 || mixed[i - 1].weight >= row.weight), JSON.stringify(mixed))
check('the most reinforced tag wins', mixed[0]?.tag === 'mar', JSON.stringify(mixed))
check('one obra contributes each of its tags', mixed.some((row) => row.tag === 'ciudad') && mixed.some((row) => row.tag === 'luz'), JSON.stringify(mixed))

// Case 3: a pending comment is not taste, so four likes plus it stay below five.
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${AMAR}', 'v3@x.invalid', '${V3}'),
    ('${ALUZ}', 'v3@x.invalid', '${V3}'),
    ('${AVIEW}', 'v3@x.invalid', '${V3}'),
    ('${ADET}', 'v3@x.invalid', '${V3}');
  insert into public.artwork_comments (artwork_id, user_id, author_name, body, status)
    values ('${AMAR}', '${V3}', 'Tres', 'esperando', 'pending');
`)
const pending = await taste(V3)
check('a pending comment does not count', pending.length === 0, JSON.stringify(pending))

// Case 4: the opt-out wins over plenty of signal.
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${AMAR}', 'v4@x.invalid', '${V4}'),
    ('${ALUZ}', 'v4@x.invalid', '${V4}'),
    ('${AMIX}', 'v4@x.invalid', '${V4}'),
    ('${AOLD}', 'v4@x.invalid', '${V4}'),
    ('${ANEW}', 'v4@x.invalid', '${V4}');
`)
const optedOut = await taste(V4)
check('personalize = false returns nothing', optedOut.length === 0, JSON.stringify(optedOut))

// Case 5: details weighs more than view; untagged obras only reach the floor.
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${AN1}', 'v5@x.invalid', '${V5}'),
    ('${AN2}', 'v5@x.invalid', '${V5}'),
    ('${AN3}', 'v5@x.invalid', '${V5}');
  insert into public.gallery_attention_sessions (id, user_id) values ('${S5}', '${V5}');
  insert into public.gallery_attention (session_id, artwork_id, mode, milliseconds, episodes) values
    ('${S5}', '${AVIEW}', 'view', 30000, 1),
    ('${S5}', '${ADET}', 'details', 30000, 1);
`)
const modes = await taste(V5)
const byTag = Object.fromEntries(modes.map((row) => [row.tag, row.weight]))
check('details beats view at the same milliseconds', byTag.detalle > byTag.vista, JSON.stringify(modes))
check('details is the strongest tag here', byTag.detalle === 1, String(byTag.detalle))
check('view keeps two thirds of the details weight', Math.abs(byTag.vista - 2 / 3) < 1e-6, String(byTag.vista))
check('untagged obras add no tags', modes.length === 2, JSON.stringify(modes))

// Case 6: an interaction from 90 days ago is worth half of today's.
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id, created_at) values
    ('${AOLD}', 'v6@x.invalid', '${V6}', now() - interval '90 days'),
    ('${ANEW}', 'v6@x.invalid', '${V6}', now()),
    ('${AN1}', 'v6@x.invalid', '${V6}', now()),
    ('${AN2}', 'v6@x.invalid', '${V6}', now()),
    ('${AN3}', 'v6@x.invalid', '${V6}', now());
`)
const decayed = await taste(V6)
const decayByTag = Object.fromEntries(decayed.map((row) => [row.tag, row.weight]))
check('both the old and the new tag are present', 'viejo' in decayByTag && 'nuevo' in decayByTag, JSON.stringify(decayed))
check('today outweighs 90 days ago', decayByTag.nuevo > decayByTag.viejo, JSON.stringify(decayed))
check('90 days halves the weight', Math.abs(decayByTag.viejo - 0.5) < 0.02, String(decayByTag.viejo))

// Case 7: the same obra watched in two sessions is one signal, capped at 60 s.
await db.exec(`
  insert into public.artwork_likes (artwork_id, email, user_id) values
    ('${AN1}', 'v7@x.invalid', '${V7}'),
    ('${AN2}', 'v7@x.invalid', '${V7}'),
    ('${AN3}', 'v7@x.invalid', '${V7}'),
    ('${AVIEW}', 'v7@x.invalid', '${V7}'),
    ('${ALUZ}', 'v7@x.invalid', '${V7}');
  insert into public.gallery_attention_sessions (id, user_id) values ('${S7A}', '${V7}'), ('${S7B}', '${V7}');
  insert into public.gallery_attention (session_id, artwork_id, mode, milliseconds, episodes) values
    ('${S7A}', '${AMAR}', 'view', 30000, 1),
    ('${S7B}', '${AMAR}', 'view', 30000, 1);
`)
const capped = await taste(V7)
const capByTag = Object.fromEntries(capped.map((row) => [row.tag, row.weight]))
check('two sessions on one obra add one signal', capped.length === 3, JSON.stringify(capped))
check('attention stops at 60 seconds', Math.abs(capByTag.mar - 1 / 3) < 1e-6, String(capByTag.mar))

// Nothing at all is still zero rows, not an error.
const nobody = await db.query('select tag from public.community_taste(null)')
check('a null visitor returns nothing', nobody.rows.length === 0, JSON.stringify(nobody.rows))

if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('community taste ok')
