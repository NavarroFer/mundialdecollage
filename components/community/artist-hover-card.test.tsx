import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import es from '@/lib/i18n/messages/es'
import ru from '@/lib/i18n/messages/ru'

vi.stubGlobal('React', React)
// The mock reads this each time, so a test can switch language.
let current: { locale: string; m: typeof es } = { locale: 'es', m: es }
vi.mock('@/lib/i18n/client', () => ({ useI18n: () => current }))

import { ArtistHoverCard, CardBody } from './artist-hover-card'

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

describe('CardBody', () => {
  const card = {
    name: 'Ana Pérez',
    countryCode: 'AR',
    instagram: null,
    website: null,
    techniques: ['Mixta', 'Técnica inventada'],
    artworks: 2,
    images: ['/a.jpg', '/b.jpg'],
  }

  it('shows the techniques in the visitor\'s language, and an unknown one as it came', () => {
    current = { locale: 'ru', m: ru as unknown as typeof es }
    const html = renderToStaticMarkup(<CardBody card={card} name="Ana Pérez" profileId={id} />)
    current = { locale: 'es', m: es }
    expect(html).toContain(ru.common.techniques.Mixta)
    expect(html).not.toContain('>Mixta<')
    expect(html).toContain('>Técnica inventada<')
  })

  it('shows every thumbnail whole, never cropped to a square', () => {
    const html = renderToStaticMarkup(<CardBody card={card} name="Ana Pérez" profileId={id} />)
    expect(html).toContain('object-contain')
    expect(html).not.toContain('object-cover')
  })
})
