import { NextResponse } from 'next/server'
import { getFinalists } from '@/lib/finalists'
import { getCallState } from '@/lib/call-state'
import { artistProfileSlug } from '@/lib/artist-profiles'
import { obraNeighbors, type ObraDetail } from '@/lib/obra-detail'

// Everything /obras/[slug] shows, for the popup that opens an obra over the
// list it was clicked in (components/obra-modal.tsx). Only published obras:
// the popup opens from public listings. Built from the cached listing at most
// once a minute per obra (as /api/obras) and served from the CDN in between,
// so opening an obra costs no page render.
export const revalidate = 60

export function generateStaticParams() {
  return []
}

export async function GET(_request: Request, { params }: RouteContext<'/api/obras/[slug]'>) {
  const { slug } = await params
  const [finalists, { open }] = await Promise.all([getFinalists(), getCallState()])
  const obra = finalists.find((artwork) => artwork.slug === slug)
  if (!obra) return NextResponse.json(null, { status: 404 })

  const detail: ObraDetail = {
    obra,
    artistHref: `/artistas/${artistProfileSlug(obra.name, obra.profileId)}`,
    ...obraNeighbors(finalists, obra),
    callOpen: open,
  }
  return NextResponse.json(detail)
}
