import { describe, expect, it } from 'vitest'
import { tagSiteLinks } from './mail-links'

const SITE = 'https://mundialdecollage.com.ar'
const link = (href: string) => `<a href="${href}">x</a>`

describe('tagSiteLinks', () => {
  it('adds desde=mail to links to the site, keeping the path, the query and the hash', () => {
    expect(tagSiteLinks(link(`${SITE}/club`), SITE)).toBe(link(`${SITE}/club?desde=mail`))
    expect(tagSiteLinks(link(`${SITE}/obras/una-obra?x=1#comentarios`), SITE)).toBe(link(`${SITE}/obras/una-obra?x=1&amp;desde=mail#comentarios`))
    expect(tagSiteLinks(link(SITE), SITE)).toBe(link(`${SITE}/?desde=mail`))
  })

  it('treats www and the bare domain as the same site, in either case', () => {
    expect(tagSiteLinks(link('https://www.MundialDeCollage.com.ar/tienda'), SITE)).toContain('desde=mail')
  })

  it('works with single quotes and with every link in the mail', () => {
    const html = `<a href='${SITE}/a'>a</a> <a href="${SITE}/b">b</a>`
    expect(tagSiteLinks(html, SITE)).toBe(`<a href='${SITE}/a?desde=mail'>a</a> <a href="${SITE}/b?desde=mail">b</a>`)
  })

  it('keeps an address that came escaped as it was, without escaping it twice', () => {
    const tagged = tagSiteLinks(link(`${SITE}/x?a=1&amp;b=2`), SITE)
    expect(tagged).toBe(link(`${SITE}/x?a=1&amp;b=2&amp;desde=mail`))
    expect(tagged).not.toContain('&amp;amp;')
  })

  it.each([
    ['another site', 'https://example.com/club'],
    ['a site that only contains the name', 'https://mundialdecollage.com.ar.evil.test/club'],
    ['mailto', 'mailto:hola@mundialdecollage.com.ar'],
    ['a relative link', '/club'],
    ['a placeholder', '{{link_obra}}'],
    ['a placeholder in the middle', `${SITE}/obras/{{obra}}`],
    ['the unsubscribe link', `${SITE}/api/unsubscribe?id=1`],
    ['a link that already has desde', `${SITE}/tienda?desde=mail`],
    ['a link that already has utm_source', `${SITE}/club?utm_source=ig`],
    ['javascript', 'javascript:alert(1)'],
  ])('leaves %s alone', (_label, href) => {
    expect(tagSiteLinks(link(href), SITE)).toBe(link(href))
  })

  it('does not touch text that only looks like a link', () => {
    const html = `<p>Entrá a ${SITE}/club hoy</p>`
    expect(tagSiteLinks(html, SITE)).toBe(html)
  })

  it('returns the mail untouched when the site address is not valid', () => {
    expect(tagSiteLinks(link(`${SITE}/club`), 'not a url')).toBe(link(`${SITE}/club`))
  })
})

describe('withUnsubscribeFooter', () => {
  it('tags the body links but not its own unsubscribe link', async () => {
    const { withUnsubscribeFooter } = await import('./email-translation')
    const { getSiteUrl } = await import('./site')
    const site = getSiteUrl()
    const html = withUnsubscribeFooter(`<a href="${site}/club">club</a>`, 'contact-1', 'es')
    expect(html).toContain(`href="${site}/club?desde=mail"`)
    expect(html).toContain(`href="${site}/api/unsubscribe?id=contact-1"`)
    expect(html).not.toContain('unsubscribe?id=contact-1&amp;desde')
  })
})
