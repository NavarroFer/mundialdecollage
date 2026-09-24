import { describe, expect, it } from 'vitest'
import type { EmailDocument } from '@/lib/email-blocks'
import {
  applyEmailTexts,
  contactLocale,
  emailTextsFingerprint,
  extractEmailTexts,
  translationState,
} from './email-translation'

const doc: EmailDocument = {
  blocks: [
    { id: 'b1', type: 'image', url: 'https://x/logo.png', alt: 'Mundial de Collage', link: '', widthPct: 40 },
    { id: 'b2', type: 'heading', text: 'Hola {{nombre}},', align: 'left', size: 'md' },
    { id: 'b3', type: 'text', text: 'Gracias por tu obra.', align: 'left' },
    { id: 'b4', type: 'button', text: 'Ver más', url: 'https://mundialdecollage.com.ar', align: 'left', color: 'red' },
    { id: 'b5', type: 'divider' },
  ],
}

const english = {
  subject: 'You are in',
  'b1.alt': 'Collage World Cup',
  'b2.text': 'Hi {{nombre}},',
  'b3.text': 'Thanks for your artwork.',
  'b4.text': 'See more',
}

describe('email translation', () => {
  it('extracts only the words, keyed by block', () => {
    expect(extractEmailTexts('Ya estás', doc)).toEqual({
      subject: 'Ya estás',
      'b1.alt': 'Mundial de Collage',
      'b2.text': 'Hola {{nombre}},',
      'b3.text': 'Gracias por tu obra.',
      'b4.text': 'Ver más',
    })
  })

  it('swaps in translated words and keeps links, images and layout', () => {
    const translated = applyEmailTexts('Ya estás', doc, english)
    expect(translated.subject).toBe('You are in')
    expect(translated.doc.blocks[0]).toMatchObject({ alt: 'Collage World Cup', url: 'https://x/logo.png' })
    expect(translated.doc.blocks[3]).toMatchObject({ text: 'See more', url: 'https://mundialdecollage.com.ar' })
    expect(translated.doc.blocks[4]).toEqual(doc.blocks[4])
  })

  it('marks translations outdated when the wording changes, not when a link does', () => {
    const source = emailTextsFingerprint('Ya estás', doc)
    const relinked: EmailDocument = {
      blocks: doc.blocks.map((block) => (block.type === 'button' ? { ...block, url: 'https://otro.link' } : block)),
    }
    const reworded: EmailDocument = {
      blocks: doc.blocks.map((block) => (block.type === 'text' ? { ...block, text: 'Gracias!' } : block)),
    }
    const email = { subject: 'Ya estás', translations: { en: english }, translations_source: source }
    expect(translationState({ ...email, body_json: relinked })).toEqual({ status: 'translated', locales: ['en'] })
    expect(translationState({ ...email, body_json: reworded }).status).toBe('outdated')
    expect(translationState({ ...email, body_json: null }).status).toBe('html')
  })

  it('only counts a language when every text is translated', () => {
    const partial = { subject: 'You are in' }
    const source = emailTextsFingerprint('Ya estás', doc)
    expect(translationState({ subject: 'Ya estás', body_json: doc, translations: { en: partial }, translations_source: source }).status).toBe('untranslated')
  })

  it("sends each contact their country's language, Spanish without one", () => {
    expect(contactLocale('BR')).toBe('pt')
    expect(contactLocale('CH')).toBe('de')
    expect(contactLocale(null)).toBe('es')
  })
})
