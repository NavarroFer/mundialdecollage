// Read-only: why «Recibimos N obras» (get_total_submissions_count) is larger
// than the hero's «Ya participan N obras» (home_stats().artworks).
// node --env-file=.env.local tmp/obras-gap.mts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltan credenciales Supabase en .env.local.')
const db = createClient(url, key, { auth: { persistSession: false } })

type Row = Record<string, any>

async function readAll(table: string, columns: string) {
  const rows: Row[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 499)
    if (error || !data) throw new Error(`${table}: ${error?.message ?? 'sin datos'}`)
    rows.push(...(data as Row[]))
    if (data.length < 500) return rows
  }
}

const filled = (v: unknown) => typeof v === 'string' && v.trim() !== ''

const [legacy, artworks, profiles] = await Promise.all([
  readAll('legacy_submissions', '*'),
  readAll('artworks', '*'),
  readAll('profiles', 'id, is_public, name, country_code'),
])
const profileById = new Map(profiles.map((p) => [p.id, p]))

function publicationGaps(a: Row): string[] {
  const p = profileById.get(a.profile_id)
  const gaps: string[] = []
  if (a.archived_at) gaps.push('obra archivada')
  if (!a.is_selected) gaps.push('obra no seleccionada')
  if (!p) gaps.push('sin perfil')
  else {
    if (!p.is_public) gaps.push('perfil sin publicar')
    if (!filled(p.name)) gaps.push('artista sin nombre')
    if (!filled(p.country_code)) gaps.push('artista sin país')
  }
  if (!filled(a.slug)) gaps.push('obra sin slug')
  if (!filled(a.image_url)) gaps.push('obra sin imagen')
  return gaps
}
const isPublished = (a: Row) => publicationGaps(a).filter((g) => g !== 'obra archivada').length === 0

const artworksByLegacy = new Map<string, Row[]>()
for (const a of artworks) {
  if (!a.legacy_submission_id) continue
  artworksByLegacy.set(a.legacy_submission_id, [...(artworksByLegacy.get(a.legacy_submission_id) ?? []), a])
}

// The received set, exactly as get_total_submissions_count() counts it.
const receivedLegacy = legacy.filter((l) => !l.archived_at)
const receivedNative = artworks.filter((a) => !a.archived_at && a.is_entered && !a.legacy_submission_id)
const published = artworks.filter(isPublished)

const reasons = new Map<string, number>()
const bump = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
let receivedAndPublished = 0
const publishedSeen = new Set<string>()

for (const l of receivedLegacy) {
  const linked = artworksByLegacy.get(l.id) ?? []
  const live = linked.find(isPublished)
  if (live) {
    receivedAndPublished++
    publishedSeen.add(live.id)
    continue
  }
  if (linked.length === 0) bump('Registro sin obra creada en el sitio')
  else bump(publicationGaps(linked[0]).join(' + '))
}
for (const a of receivedNative) {
  if (isPublished(a)) {
    receivedAndPublished++
    publishedSeen.add(a.id)
  } else bump(`(subida en el sitio) ${publicationGaps(a).join(' + ')}`)
}

// Published obras the received count doesn't include (would shrink the gap).
const publishedOutside = published.filter((a) => !publishedSeen.has(a.id))
const outsideReasons = new Map<string, number>()
for (const a of publishedOutside) {
  const l = a.legacy_submission_id ? legacy.find((x) => x.id === a.legacy_submission_id) : null
  const why = a.legacy_submission_id
    ? (l ? (l.archived_at ? 'su fila del Registro está archivada' : 'comparte fila del Registro con otra obra publicada') : 'apunta a un Registro inexistente')
    : (a.archived_at ? 'archivada' : !a.is_entered ? 'is_entered = false' : 'otro')
  outsideReasons.set(why, (outsideReasons.get(why) ?? 0) + 1)
}

console.log({
  recibidas: receivedLegacy.length + receivedNative.length,
  'recibidas (Registro)': receivedLegacy.length,
  'recibidas (subidas en el sitio)': receivedNative.length,
  publicadas: published.length,
  'recibidas y publicadas': receivedAndPublished,
})
console.log('\nRecibidas que no se publican, por motivo:')
for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${reason}`)
console.log(`\nPublicadas que el conteo de recibidas no incluye: ${publishedOutside.length}`)
for (const [reason, n] of outsideReasons) console.log(`  ${n}\t${reason}`)
