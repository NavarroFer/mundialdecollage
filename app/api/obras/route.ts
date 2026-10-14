import { NextResponse } from 'next/server'
import { getFinalists } from '@/lib/finalists'
import type { ObraEntry } from '@/lib/artwork-search'

// Every published obra, trimmed to what the homepage search matches on and
// the map's cards draw. Served from the CDN, so neither costs a database
// query or a few hundred KB in every home render. Rebuilt at most once an
// hour, as the cached listing it comes from (lib/public-data-cache.ts): each
// rebuild rewrites those few hundred KB as ISR writes, billed per 8 KB.
// Changes made through the app drop it right away (refreshPublicData).
export const revalidate = 3600

export async function GET() {
  const entries: ObraEntry[] = (await getFinalists()).map(({ slug, artworkTitle, name, countryCode, imageUrl }) => ({
    slug,
    title: artworkTitle,
    name,
    countryCode,
    imageUrl,
  }))
  return NextResponse.json(entries)
}
