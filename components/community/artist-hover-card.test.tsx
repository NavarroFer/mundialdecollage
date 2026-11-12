import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import es from '@/lib/i18n/messages/es'

vi.stubGlobal('React', React)
vi.mock('@/lib/i18n/client', () => ({ useI18n: () => ({ locale: 'es', m: es }) }))

import { ArtistHoverCard } from './artist-hover-card'

const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('ArtistHoverCard', () => {
  const html = renderToStaticMarkup(
    <ArtistHoverCard profileId={id} name="Ana Pérez" avatar={<span>AP</span>} meta={<p>hace 2 h</p>} />,
  )

  it('links the name to the artist profile', () => {
    expect(html).toContain(`href="/artistas/ana-perez-${id}"`)
    expect(html).toContain('>Ana Pérez</a>')
  })

  it('keeps the avatar and the line under the name, outside the link text', () => {
    expect(html).toContain('<span>AP</span>')
    expect(html).toContain('<p>hace 2 h</p>')
  })

  it('starts closed: no card, no request, nothing announced as expanded', () => {
    expect(html).not.toContain('role="dialog"')
    expect(html).toContain('aria-expanded="false"')
  })
})
