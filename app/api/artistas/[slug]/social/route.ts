import { NextResponse } from 'next/server'
import { getArtistSocial } from '@/lib/artist-social'

// Likes and comments of an artist's obras, for their profile
// (app/[locale]/(site)/artistas/[slug]/artist-feed.tsx). The profile page
// itself stays static: this arrives after it, from the CDN. Rebuilt at most
// every 10 minutes per artist, and only while someone visits: a new like or
// an approved comment shows up within that window. Every rebuild is an ISR
// write and a few head counts, so not shorter.
export const revalidate = 600

export function generateStaticParams() {
  return []
}

export async function GET(_request: Request, { params }: RouteContext<'/api/artistas/[slug]/social'>) {
  const { slug } = await params
  const social = await getArtistSocial(slug)
  if (!social) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(social)
}
