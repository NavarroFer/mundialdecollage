import { NextResponse } from 'next/server'
import { getFinalists } from '@/lib/finalists'
import type { ObraEntry } from '@/lib/artwork-search'

// Every published obra, trimmed to what the homepage search matches on and
// the map's cards draw. Built at most once a minute (as often as the home's
// own numbers) and served from the CDN in between, so neither costs a
// database query or a few hundred KB in every home render.
export const revalidate = 60

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
