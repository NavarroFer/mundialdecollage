import { NextResponse } from 'next/server'
import { getClubHouses } from '@/lib/club-map-data'

// Every active Club gallery: the houses of the Club's map (those placed on
// it) and the galleries the Puerta al Club leads to. Served from the CDN so
// neither costs a Function per visit. A member saving their gallery drops it right away
// (refreshClubGallery); a gallery that starts or stops paying shows up
// within the hour.
export const revalidate = 3600

export async function GET() {
  return NextResponse.json(await getClubHouses())
}
