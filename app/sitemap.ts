import type { MetadataRoute } from 'next'
import { artistProfileSlug } from '@/lib/artist-profiles'
import { getSiteUrl } from '@/lib/site'
import { getFinalists } from '@/lib/finalists'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/edicion-2026`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/participantes`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${siteUrl}/galeria-3d`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${siteUrl}/tienda`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/partners`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/taller/inscripcion`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/terminos-y-condiciones`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/politica-de-privacidad`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const finalists = await getFinalists()
  const obraRoutes: MetadataRoute.Sitemap = finalists.map((f) => ({
    url: `${siteUrl}/obras/${f.slug}`,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  const seenArtists = new Set<string>()
  const artistRoutes: MetadataRoute.Sitemap = finalists.flatMap((finalist) => {
    if (seenArtists.has(finalist.profileId)) return []
    seenArtists.add(finalist.profileId)
    return [{
      url: `${siteUrl}/artistas/${artistProfileSlug(finalist.name, finalist.profileId)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }]
  })

  return [...staticRoutes, ...obraRoutes, ...artistRoutes]
}
