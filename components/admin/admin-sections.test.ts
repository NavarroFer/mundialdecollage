import { describe, expect, it } from 'vitest'
import { adminSections, isAdminGroupOpen } from './admin-sections'

describe('isAdminGroupOpen', () => {
  it('opens only the group of the current page until the admin says otherwise', () => {
    expect(isAdminGroupOpen('Convocatoria', 'Convocatoria', new Set(), new Set())).toBe(true)
    expect(isAdminGroupOpen('Tienda', 'Convocatoria', new Set(), new Set())).toBe(false)
    expect(isAdminGroupOpen('Tienda', 'Convocatoria', new Set(['Tienda']), new Set())).toBe(true)
    expect(isAdminGroupOpen('Convocatoria', 'Convocatoria', new Set(), new Set(['Convocatoria']))).toBe(false)
  })
})

describe('admin sections', () => {
  it('keeps every destination once, with Comunidad on its own', () => {
    const hrefs = adminSections.flatMap((section) => section.items.map((item) => item.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs).toEqual(expect.arrayContaining(['/admin/publicaciones', '/admin/club', '/admin/obras', '/admin/campanas', '/galeria-3d']))
    expect(adminSections.find((section) => section.label === 'Comunidad')?.items.map((item) => item.href)).toEqual(['/admin/publicaciones'])
    expect(adminSections.map((section) => section.label).slice(0, 2)).toEqual(['Convocatoria', 'Comunidad'])
  })
})
