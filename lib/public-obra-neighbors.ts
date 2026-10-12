import { getFinalistIndex, getPublishedFinalistBySlug, type Finalist } from '@/lib/finalists'
import { toSummary, type ObraNeighbors } from '@/lib/obra-detail'

// Register dependencies only on the cards this page actually displays. A
// change to a distant obra no longer invalidates this page via getFinalists().
export async function getPublicObraNeighbors(obra: Finalist): Promise<ObraNeighbors> {
  const listing = await getFinalistIndex()
  const index = listing.findIndex(({ slug }) => slug === obra.slug)
  const relatedSlugs = listing.filter(item => item.profileId === obra.profileId && item.slug !== obra.slug)
    .slice(0, 3).map(item => item.slug)
  const previousSlug = index > 0 ? listing[index - 1].slug : undefined
  const nextSlug = index >= 0 ? listing[index + 1]?.slug : undefined
  const slugs = [...new Set([...relatedSlugs, previousSlug, nextSlug].filter((slug): slug is string => Boolean(slug)))]
  const works = await Promise.all(slugs.map(getPublishedFinalistBySlug))
  const summaries = new Map(works.flatMap(work => work ? [[work.slug, toSummary(work)] as const] : []))
  return {
    related: relatedSlugs.flatMap(slug => summaries.get(slug) ?? []),
    previous: previousSlug ? summaries.get(previousSlug) ?? null : null,
    next: nextSlug ? summaries.get(nextSlug) ?? null : null,
  }
}
