import { notFound } from 'next/navigation'

// Any address with no page: the site's own not-found (app/[locale]/not-found.tsx),
// inside the layout. Rendered per request so made-up URLs don't pile up as
// cached pages.
export const dynamic = 'force-dynamic'

export default function MissingPage() {
  notFound()
}
