import { NextResponse } from 'next/server'
import { getClubHouses } from '@/lib/club-map-data'

// The houses of the Club's map, served from the CDN so the map costs no
// Function per visit. A member saving their gallery drops it right away
// (refreshClubGallery); a gallery that starts or stops paying shows up
// within the hour.
export const revalidate = 3600

export async function GET() {
  return NextResponse.json(await getClubHouses())
}
