import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    // Besides /admin: downloads drawn on demand (story image, certificate)
    // and the Clarity proxy, which crawlers would otherwise run through our
    // Functions on every page they render.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/obras/*/historia', '/obras/*/certificado', '/monitoring/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
