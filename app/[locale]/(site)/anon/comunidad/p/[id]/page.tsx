import { renderAsAnonymous } from '@/lib/render-mode'
import CommunityPostPage, { generateMetadata as pageMetadata } from '../../../../comunidad/p/[id]/page'

// Anonymous copy of one post (lib/static-pages.ts). Built when first asked,
// per language. The comments load in the browser.
export const revalidate = 86400

export function generateStaticParams() {
  return []
}

type PostRoute = { params: Promise<{ id: string }> }

export function generateMetadata(props: PostRoute) {
  renderAsAnonymous()
  return pageMetadata(props)
}

export default function AnonymousCommunityPostPage(props: PostRoute) {
  renderAsAnonymous()
  return <CommunityPostPage params={props.params} />
}
