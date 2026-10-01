import { describe, expect, it } from 'vitest'
import { CAMPAIGN_TEMPLATE_AUDIENCES, TEMPLATE_AUDIENCES, parseAudiences } from './template-audiences'
import { CAMPAIGN_AUDIENCES } from './campaign-audience'
import { SYSTEM_TEMPLATES } from './system-templates'

describe('parseAudiences', () => {
  it('keeps valid, unique audiences in catalogue order', () => {
    expect(parseAudiences(['clientes', 'artistas', 'nope', 'artistas', 7])).toEqual(['artistas', 'clientes'])
    expect(parseAudiences([])).toEqual([])
  })
})

describe('catalogue', () => {
  it('suggests templates for every campaign audience', () => {
    for (const { value } of CAMPAIGN_AUDIENCES) expect(CAMPAIGN_TEMPLATE_AUDIENCES[value]?.length).toBeGreaterThan(0)
  })

  it('tags every automatic template with known audiences', () => {
    const known = new Set(TEMPLATE_AUDIENCES.map((a) => a.value))
    for (const definition of Object.values(SYSTEM_TEMPLATES)) {
      expect(definition.audiences.length).toBeGreaterThan(0)
      for (const audience of definition.audiences) expect(known.has(audience)).toBe(true)
    }
  })
})
