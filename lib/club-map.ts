// Where each Club member's «house» sits on the map. The member clicks the
// map in the editor; only a point rounded to a tenth of a degree (about
// 11 km) is stored (supabase/migrations/20261029200000_club_gallery_home.sql),
// and the public map moves each one a little more, always the same way, so
// two neighbours never sit on top of each other.

export type ClubHouse = {
  slug: string
  title: string
  artistName: string
  countryCode: string | null
  /** [longitude, latitude], as the maps take them. */
  coordinates: [number, number]
  obras: number
}

const round = (value: number) => Math.round(value * 10) / 10

/** The point the editor sends, rounded as the database will keep it; null for no house; undefined when invalid. */
export function parseHome(form: FormData): { lat: number; lng: number } | null | undefined {
  const lat = String(form.get('home_lat') ?? '').trim()
  const lng = String(form.get('home_lng') ?? '').trim()
  if (!lat && !lng) return null
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined
  return { lat: round(latitude), lng: round(longitude) }
}

/** Up to ±0.04° (about 4 km), fixed per gallery so a house never jumps between visits. */
export function jitterHome(slug: string, lat: number, lng: number): [number, number] {
  let hash = 2166136261
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const unit = (bits: number) => ((bits & 0xffff) / 0xffff) * 2 - 1
  return [lng + unit(hash) * 0.04, lat + unit(hash >>> 16) * 0.04]
}

export type HouseRow = { slug: string; title: string; artist_name: string; country_code: string | null; home_lat: number | string; home_lng: number | string; obras: number }

export function clubHouseFromRow(row: HouseRow): ClubHouse {
  return {
    slug: row.slug,
    title: row.title,
    artistName: row.artist_name,
    countryCode: row.country_code,
    coordinates: jitterHome(row.slug, Number(row.home_lat), Number(row.home_lng)),
    obras: row.obras,
  }
}
