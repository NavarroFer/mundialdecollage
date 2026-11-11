// The Comunidad moderation switch: one row, admins only, and a second apply
// does not turn it back on.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261112170000_community_ai_moderation.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const ADMIN = 'mundialdecollage@gmail.com'
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

async function as(role, email, text) {
  const claims = JSON.stringify({ sub: '00000000-0000-4000-8000-000000000001', email: email ?? '', role }).replaceAll("'", "''")
  await db.exec(`
    select set_config('request.jwt.claims', '${claims}', false);
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

const row = (await db.query(`select ai_moderation from public.community_settings`)).rows[0]
check('the switch starts on', row?.ai_moderation === true, JSON.stringify(row))
const anon = await as('anon', null, 'select ai_moderation from public.community_settings')
check('anon cannot read the switch', Boolean(anon.error), anon.error)
const artist = await as('authenticated', 'ana@x.invalid', 'select ai_moderation from public.community_settings')
check('an artist cannot read the switch', !artist.error && artist.rows.length === 0, JSON.stringify(artist))
const artistWrite = await as('authenticated', 'ana@x.invalid', 'update public.community_settings set ai_moderation = false')
check('an artist cannot flip the switch', !artistWrite.error && (await db.query('select ai_moderation from public.community_settings')).rows[0].ai_moderation === true, JSON.stringify(artistWrite))
const admin = await as('authenticated', ADMIN, 'update public.community_settings set ai_moderation = false returning ai_moderation')
check('an admin can turn it off', !admin.error && admin.rows[0]?.ai_moderation === false, JSON.stringify(admin))
await db.exec(sql)
const kept = (await db.query('select ai_moderation from public.community_settings')).rows[0]
check('applying the migration again leaves the switch off', kept.ai_moderation === false, JSON.stringify(kept))

if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('moderation switch ok')
