export { default, alt, size, contentType } from '../../../obras/[slug]/opengraph-image'

// Segment config can't be re-exported: same values as the page's own.
export const revalidate = 86400

export function generateStaticParams() {
  return []
}
