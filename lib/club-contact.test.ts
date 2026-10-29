import { describe, expect, it } from 'vitest'
import { consultLink, safeWebAddress, whatsappLink } from './club-contact'

describe('safeWebAddress', () => {
  it('lets http and https through and normalises them', () => {
    expect(safeWebAddress('https://ana.example/obra')).toBe('https://ana.example/obra')
    expect(safeWebAddress('  http://ana.example ')).toBe('http://ana.example/')
  })
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'mailto:ana@example.com', 'ana.example', '', null, undefined])(
    'refuses %s', (value) => {
      expect(safeWebAddress(value as string | null | undefined)).toBeNull()
    })
})

describe('whatsappLink', () => {
  it('keeps only the digits of the number and encodes the message', () => {
    expect(whatsappLink('+54 9 223 555-1234', 'Hola, vi «Mi obra»')).toBe(`https://wa.me/5492235551234?text=${encodeURIComponent('Hola, vi «Mi obra»')}`)
  })
  it.each(['', '12345', 'llamame', '1'.repeat(16), null, undefined])('makes no link for %s', (value) => {
    expect(whatsappLink(value as string | null | undefined, 'hola')).toBeNull()
  })
  it('cannot be bent into another address by what is typed in the number', () => {
    expect(whatsappLink('5491122223333/../evil?x=', 'hola')).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
  })
})

describe('consultLink', () => {
  it('prefers WhatsApp, falls back to the web address and is null without either', () => {
    expect(consultLink({ whatsapp: '+54 9 11 5555 6666', url: 'https://ana.example' }, 'hola')).toContain('wa.me')
    expect(consultLink({ url: 'https://ana.example' }, 'hola')).toBe('https://ana.example/')
    expect(consultLink({ whatsapp: 'x', url: 'javascript:alert(1)' }, 'hola')).toBeNull()
    expect(consultLink({}, 'hola')).toBeNull()
    expect(consultLink(undefined, 'hola')).toBeNull()
  })
})
