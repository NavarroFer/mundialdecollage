import { renderAsAnonymous } from '@/lib/render-mode'
import ArtistPage, { generateMetadata as artistMetadata } from '../../../artistas/[slug]/page'

// /artistas/[slug] for visitors with nothing personal (lib/static-pages.ts):
// built the first time it's asked for, per language, and redrawn once a day
// or right away when the app changes its data (lib/public-data-cache.ts).
export const revalidate = 86400

export function generateStaticParams() {
  return []
}

export function generateMetadata(props: PageProps<'/[locale]/anon/artistas/[slug]'>) {
  renderAsAnonymous()
  return artistMetadata(props)
}

export default function AnonymousArtistPage({ params }: PageProps<'/[locale]/anon/artistas/[slug]'>) {
  renderAsAnonymous()
  return <ArtistPage params={params} />
}
