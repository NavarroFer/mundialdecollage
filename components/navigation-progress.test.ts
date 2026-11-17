import { describe, expect, it } from 'vitest'
import { leadsToAnotherPage } from './navigation-progress'

const HERE = 'https://mundialdecollage.com.ar/obras?pais=AR#top'

function anchor(href: string, attrs: Record<string, string> = {}) {
  return {
    href: new URL(href, HERE).href,
    target: attrs.target ?? '',
    getAttribute: (name: string) => (name === 'href' ? href : attrs[name] ?? null),
    hasAttribute: (name: string) => name in attrs,
  } as unknown as HTMLAnchorElement
}
const click = (init: Partial<MouseEvent> = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init }) as MouseEvent

describe('leadsToAnotherPage', () => {
  it('starts for another page of the site', () => {
    expect(leadsToAnotherPage(anchor('/galeria-3d'), click(), HERE)).toBe(true)
    expect(leadsToAnotherPage(anchor('/obras?pais=UY'), click(), HERE)).toBe(true)
  })

  it('stays out of the way of everything that does not load a page here', () => {
    expect(leadsToAnotherPage(anchor('/obras?pais=AR#mapa'), click(), HERE)).toBe(false) // same page
    expect(leadsToAnotherPage(anchor('#mapa'), click(), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('https://instagram.com/x'), click(), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('/galeria-3d', { target: '_blank' }), click(), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('/galeria-3d'), click({ metaKey: true }), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('/galeria-3d'), click({ button: 1 }), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('/mundial-de-collage.pdf'), click(), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('/certificado', { download: '' }), click(), HERE)).toBe(false)
    expect(leadsToAnotherPage(anchor('mailto:hola@x.invalid'), click(), HERE)).toBe(false)
  })
})
