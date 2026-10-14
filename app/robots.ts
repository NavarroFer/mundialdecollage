import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

// Crawlers that gather pages to train AI models. They bring no visitors,
// and each sweep rebuilds every obra page and its share image in every
// language: on 12/10 meta-externalagent alone caused ~15,900 ISR write units
// in four hours, a third of that day's. Link previews (facebookexternalhit,
// WhatsApp, Twitterbot) and search engines are other user agents and stay in.
const AI_TRAINING_CRAWLERS =['meta-externalagent', 'GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider']

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: [
      // Besides /admin: downloads drawn on demand (story image, certificate)
      // and the Clarity proxy, which crawlers would otherwise run through our
      // Functions on every page they render.
      { userAgent: '*', allow: '/', disallow: ['/admin', '/obras/*/historia', '/obras/*/certificado', '/monitoring/'] },
      { userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
