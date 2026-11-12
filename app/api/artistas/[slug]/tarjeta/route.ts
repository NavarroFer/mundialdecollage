import { NextResponse } from 'next/server'
import { getArtistCard } from '@/lib/artist-card-data'
import { artistProfileIdFromSlug } from '@/lib/artist-slug'
import { isUuid } from '@/lib/community'

// The card the feed shows when the pointer rests on an artist: name, country,
// techniques, links and three obras. Only what their public profile already
// shows, the same bytes for everyone, so the CDN answers (s-maxage) and the
// Function runs about once an hour per artist. No session, no cookies. The
// segment is called [slug] because the artist routes next to it use that name;
// it takes the bare profile id the feed has, or the whole profile slug.

const PUBLIC = 'public, s-maxage=3600, stale-while-revalidate=86400'
// Not public (or unknown): remembered for a minute, so a publication shows
// up soon and a guessed id can't be asked about again and again.
const MISSING = 'public, s-maxage=60, stale-while-revalidate=300'

export async function GET(_request: Request, { params }: RouteContext<'/api/artistas/[slug]/tarjeta'>) {
  const { slug } = await params
  const profileId = isUuid(slug) ? slug.toLowerCase() : artistProfileIdFromSlug(slug)
  if (!profileId) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': MISSING } })
  try {
    const card = await getArtistCard(profileId)
    if (!card) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': MISSING } })
    return NextResponse.json(card, { headers: { 'Cache-Control': PUBLIC } })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
