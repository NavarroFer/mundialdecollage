import { describe, expect, it } from 'vitest'
import { relativeTime } from './time'

const NOW = new Date('2026-10-05T15:00:00Z')
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString()

describe('relativeTime', () => {
  it('says "now" for the last minute, even with a clock running ahead', () => {
    expect(relativeTime('es', ago(20), NOW)).toBe('ahora')
    expect(relativeTime('es', ago(-90), NOW)).toBe('ahora')
  })

  it('counts minutes, hours and days in the reader’s language', () => {
    expect(relativeTime('es', ago(5 * 60), NOW)).toBe('hace 5 minutos')
    expect(relativeTime('es', ago(3 * 3600), NOW)).toBe('hace 3 horas')
    expect(relativeTime('es', ago(26 * 3600), NOW)).toBe('ayer')
    expect(relativeTime('en', ago(3 * 86400), NOW)).toBe('3 days ago')
  })

  it('switches to the date after a week', () => {
    expect(relativeTime('es', '2026-09-20T15:00:00Z', NOW)).toBe('20 de septiembre')
  })
})
