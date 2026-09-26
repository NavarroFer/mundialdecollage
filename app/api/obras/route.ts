import { NextResponse } from 'next/server'
import { getFinalists } from '@/lib/finalists'
import type { SearchEntry } from '@/lib/artwork-search'

// Every published obra, trimmed to what the homepage search matches on. Built
// at most every 5 minutes and served from the CDN in between, so opening the
// search costs no database query.
export const revalidate = 300

export async function GET() {
  const entries: SearchEntry[] = (await getFinalists()).map(({ slug, artworkTitle, name, countryCode }) => ({
    slug,
    title: artworkTitle,
    name,
    countryCode,
  }))
  return NextResponse.json(entries)
}
