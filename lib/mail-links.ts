// Marks the links to this site in a mail with ?desde=mail, so a visit that
// comes from a mail is counted as one (lib/visit-source.ts, shown in
// /admin/estadisticas). Without it the origin is only recognised when whoever
// wrote the mail remembered to type it.

const HREF = /(href\s*=\s*)(["'])(.*?)\2/gi

const withoutWww = (host: string) => host.replace(/^www\./i, '').toLowerCase()

/**
 * Adds desde=mail to every absolute link to `siteUrl` in `html`. Left alone:
 * other sites, mailto:/tel:, placeholders still to be filled, /api/ (the
 * unsubscribe link and the like) and any link that already says where it
 * comes from (desde or utm_source).
 */
export function tagSiteLinks(html: string, siteUrl: string): string {
  let site: URL
  try {
    site = new URL(siteUrl)
  } catch {
    return html
  }
  return html.replace(HREF, (whole, prefix: string, quote: string, value: string) => {
    if (value.includes('{{')) return whole
    let url: URL
    try {
      url = new URL(value.replaceAll('&amp;', '&'))
    } catch {
      return whole
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return whole
    if (withoutWww(url.hostname) !== withoutWww(site.hostname)) return whole
    if (url.pathname.startsWith('/api/')) return whole
    if (url.searchParams.has('desde') || url.searchParams.has('utm_source')) return whole
    url.searchParams.set('desde', 'mail')
    return `${prefix}${quote}${url.toString().replaceAll('&', '&amp;')}${quote}`
  })
}
