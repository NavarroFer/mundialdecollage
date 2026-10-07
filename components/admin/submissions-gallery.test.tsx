import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SubmissionsGallery } from './submissions-gallery'

vi.stubGlobal('React', React)
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/app/[locale]/(site)/admin/obras/actions', () => ({
  deleteSubmissions: vi.fn(), setSubmissionsReviewStatus: vi.fn(),
  setSubmissionsTechnique: vi.fn(), setSubmissionsVisibility: vi.fn(),
}))

describe('Admin Obras initial render', () => {
  it('renders a search control, without artwork rows or photos from the catalog', () => {
    const entries = Array.from({ length: 617 }, (_, i) => ({
      id: `artwork-${i}`, name: `Artista ${i}`, artworkTitle: `Obra ${i}`,
      isPublic: true, reviewStatus: 'unreviewed' as const,
    }))
    const html = renderToStaticMarkup(<SubmissionsGallery submissions={entries} />)
    expect(html).toContain('617 obras disponibles para buscar')
    expect(html).toContain('Escribí al menos dos caracteres')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('Artista 1')
    expect(html).not.toContain('Obra 1')
  })
})
