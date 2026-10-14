import { describe, expect, it } from 'vitest'
import robots from './robots'

function rulesFor(agent: string) {
  const { rules } = robots()
  return (Array.isArray(rules) ? rules : [rules]).filter(({ userAgent }) =>
    Array.isArray(userAgent) ? userAgent.includes(agent) : userAgent === agent,
  )
}

describe('robots.txt', () => {
  it('keeps AI training crawlers off the whole site', () => {
    expect(rulesFor('meta-externalagent')).toEqual([expect.objectContaining({ disallow: '/' })])
  })

  it('leaves link previews and search engines under the general rule', () => {
    for (const agent of ['facebookexternalhit', 'WhatsApp', 'Googlebot']) expect(rulesFor(agent)).toEqual([])
    expect(rulesFor('*')).toEqual([expect.objectContaining({ allow: '/' })])
  })
})
