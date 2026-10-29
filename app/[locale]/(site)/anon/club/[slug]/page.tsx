import { renderAsAnonymous } from '@/lib/render-mode'
import ClubGalleryPage, { generateMetadata as clubGalleryMetadata } from '../../../club/[slug]/page'

export const revalidate = 3600

export function generateStaticParams() {
  return []
}

type ClubGalleryPageProps = { params: Promise<{ locale: string; slug: string }> }

export function generateMetadata(props: ClubGalleryPageProps) {
  renderAsAnonymous()
  return clubGalleryMetadata(props)
}

export default function AnonymousClubGalleryPage({ params }: ClubGalleryPageProps) {
  renderAsAnonymous()
  return <ClubGalleryPage params={params} />
}

