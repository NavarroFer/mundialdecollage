import { getFinalists, countryCodeToName, type Finalist } from '@/lib/finalists'
import { site } from '@/lib/site'
import { gallerySlots, type Artwork } from '@/data/artworks'

const EDITION_YEAR = new Date(site.deadlineISO).getFullYear()

// Golden ratio conjugate — multiplying an index by it and keeping the
// fractional part is a classic low-discrepancy ("Weyl") sequence: it spreads
// items out evenly while still looking arbitrary, and it's fully
// deterministic from the seed alone (no state to store or cron to run).
const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949

// One stable seed per calendar day (UTC) — same visitors see the same 20
// obras all day, and the selection rotates on its own at midnight.
function dailySeed(date = new Date()): number {
  const isoDay = date.toISOString().slice(0, 10)
  let hash = 0
  for (let i = 0; i < isoDay.length; i++) {
    hash = (hash * 31 + isoDay.charCodeAt(i)) >>> 0
  }
  return hash
}

function goldenShuffle<T>(items: T[], seed: number): T[] {
  return items
    .map((item, index) => {
      const value = (seed + index) * GOLDEN_RATIO_CONJUGATE
      return { item, key: value - Math.floor(value) }
    })
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item)
}

function describeArtwork(finalist: Finalist): string {
  const parts: string[] = []
  if (finalist.technique) parts.push(`Técnica ${finalist.technique.toLowerCase()}`)
  parts.push(countryCodeToName(finalist.countryCode))
  return `${parts.join(' — ')}. Obra oficial del Mundial de Collage ${EDITION_YEAR}.`
}

// A fresh random-but-stable-for-today selection of real, published obras,
// placed into the 3D gallery's wall slots. Re-runs on every request (the
// page that calls this is already force-dynamic), so it needs no background
// job to "rotate" — the date itself is the trigger.
export async function getDailyExhibition(): Promise<Finalist[]> {
  const finalists = await getFinalists()
  // Stable input order keeps both pages aligned even when creation dates tie.
  const ordered = [...finalists].sort((a, b) => a.slug.localeCompare(b.slug))
  return goldenShuffle(ordered, dailySeed()).slice(0, gallerySlots.length)
}

export async function getGalleryArtworks(): Promise<Artwork[]> {
  const selected = await getDailyExhibition()

  return selected.map((finalist, index) => {
    const slot = gallerySlots[index]
    return {
      id: finalist.slug,
      title: finalist.artworkTitle,
      artist: finalist.name,
      countryCode: finalist.countryCode,
      year: EDITION_YEAR,
      image: finalist.imageUrl,
      description: describeArtwork(finalist),
      ...slot,
    }
  })
}
