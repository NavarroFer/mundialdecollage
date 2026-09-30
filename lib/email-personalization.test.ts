import { describe, expect, it } from 'vitest'
import { personalizeHtmlWithValues } from './email-blocks'

describe('personalizeHtmlWithValues', () => {
  it('fills profile-review data and escapes values', () => {
    const html = '<p>{{nombre}} · {{obra_dato}} · {{pais_dato}} · {{datos_faltantes}}</p>'
    expect(personalizeHtmlWithValues(html, {
      nombre: 'Ana & Sol',
      obra_dato: '<Sin título>',
      pais_dato: 'Argentina',
      datos_faltantes: 'título de la obra',
    })).toBe('<p>Ana &amp; Sol · &lt;Sin título&gt; · Argentina · título de la obra</p>')
  })

  it('uses a visible dash for a missing personalized value', () => {
    expect(personalizeHtmlWithValues('<p>{{obra_dato}}</p>', { obra_dato: null })).toBe('<p>—</p>')
  })
})
