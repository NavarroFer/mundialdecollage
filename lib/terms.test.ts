import { describe, expect, it } from 'vitest'
import { termsSections } from './terms'

describe('terms sections', () => {
  it('have unique ids, which the page uses as anchors', () => {
    const ids = termsSections.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cover the Club, since the subscription and coin buttons link to it', () => {
    const club = termsSections.find((section) => section.id === 'club')
    expect(club).toBeDefined()
    const text = JSON.stringify(club)
    for (const topic of ['Monedas', 'Arrepentimiento', 'Cobro y baja', 'Precio']) expect(text).toContain(topic)
  })

  it('name the Club among the things that are bought', () => {
    const payments = JSON.stringify(termsSections.find((section) => section.id === 'pagos'))
    expect(payments).toContain('el Club y sus monedas')
  })
})
