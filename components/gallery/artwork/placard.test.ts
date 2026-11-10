import { describe, expect, it } from 'vitest'
import { wrapTitle } from './placard'

describe('wrapTitle', () => {
  it('keeps a short title on one line', () => {
    expect(wrapTitle('Mar de fondo')).toEqual(['Mar de fondo'])
  })

  it('wraps at word boundaries within the line length', () => {
    const lines = wrapTitle('La última cena de los pájaros en el puerto')
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(21)
    expect(lines.join(' ')).toBe('La última cena de los pájaros en el puerto')
  })

  it('cuts a very long title to three lines ending in an ellipsis', () => {
    const lines = wrapTitle('una obra con un título larguísimo que sigue y sigue y sigue sin parar nunca más')
    expect(lines).toHaveLength(3)
    expect(lines[2].endsWith('…')).toBe(true)
  })

  it('does not break a single long word, and tolerates an empty title', () => {
    expect(wrapTitle('Pneumonoultramicroscopicsilicovolcanoconiosis')).toHaveLength(1)
    expect(wrapTitle('   ')).toEqual([])
  })
})
