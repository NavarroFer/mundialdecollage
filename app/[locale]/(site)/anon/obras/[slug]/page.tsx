import { renderAsAnonymous } from '@/lib/render-mode'
import ObraPage, { generateMetadata as obraMetadata } from '../../../obras/[slug]/page'

// /obras/[slug] for visitors with nothing personal (lib/static-pages.ts):
// built the first time it's asked for, per language, and redrawn once a day
// or right away when the app changes its data (lib/public-data-cache.ts).
export const revalidate = 86400

export function generateStaticParams() {
  return []
}

export function generateMetadata(props: PageProps<'/[locale]/anon/obras/[slug]'>) {
  renderAsAnonymous()
  return obraMetadata(props)
}

export default function AnonymousObraPage({ params }: PageProps<'/[locale]/anon/obras/[slug]'>) {
  renderAsAnonymous()
  return <ObraPage params={params} searchParams={Promise.resolve({})} />
}
