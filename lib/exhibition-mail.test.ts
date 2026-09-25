import { describe, expect, it } from 'vitest'
import { fillArtworkTitle, planExhibitionMails, type ExhibitionQueueRow } from './exhibition-mail'

function row(overrides: Partial<ExhibitionQueueRow>): ExhibitionQueueRow {
  return {
    day: '2026-09-26', slot: 0, artwork_id: 'a', artwork_title: 'Obra', artwork_slug: 'obra',
    artist_name: 'Ana', country_code: 'AR', email: 'ana@example.com', contact_id: 'c1',
    subscribed: true, sent_before: false,
    ...overrides,
  }
}

describe('planExhibitionMails', () => {
  it('mails subscribed artists once, in their country language', () => {
    const { send, skip } = planExhibitionMails([
      row({ slot: 0 }),
      row({ slot: 1, artwork_id: 'b', email: 'bia@example.com', contact_id: 'c2', country_code: 'BR' }),
      row({ slot: 2, artwork_id: 'c' }), // Ana's second obra today
    ])
    expect(send.map((r) => [r.email, r.locale])).toEqual([['ana@example.com', 'es'], ['bia@example.com', 'pt']])
    expect(skip.map((s) => s.reason)).toEqual(['Ya recibe hoy el aviso por otra obra'])
  })

  it('skips repeats, unsubscribes and addresses it cannot use', () => {
    const { send, skip } = planExhibitionMails([
      row({ sent_before: true }),
      row({ subscribed: false }),
      row({ contact_id: null, subscribed: null }),
      row({ email: null }),
      row({ email: 'no-arroba' }),
    ])
    expect(send).toEqual([])
    expect(skip.map((s) => s.reason)).toEqual([
      'Ya se le avisó por esta obra',
      'Se dio de baja',
      'El email no está en contactos',
      'La obra no tiene email',
      'Formato de email inválido',
    ])
  })
})

describe('fillArtworkTitle', () => {
  it('fills {{obra}} literally and escaped', () => {
    expect(fillArtworkTitle('hoy «{{ obra }}» cuelga', 'Luz & $& <sombra>')).toBe('hoy «Luz &amp; $&amp; &lt;sombra&gt;» cuelga')
  })
})
