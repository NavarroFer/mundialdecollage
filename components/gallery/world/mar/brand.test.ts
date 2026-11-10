import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND, wrapByWidth } from './brand'

describe('BRAND', () => {
  it('uses exactly the palette the site stylesheet defines', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase()
    expect(BRAND.paper).toBe(token('paper'))
    expect(BRAND.ink).toBe(token('ink'))
    expect(BRAND.blue).toBe(token('collage-blue'))
    expect(BRAND.red).toBe(token('collage-red'))
    expect(BRAND.yellow).toBe(token('collage-yellow'))
  })
})

describe('wrapByWidth', () => {
  const measure = (text: string) => text.length * 10

  it('breaks between words so no line is wider than the limit', () => {
    const lines = wrapByWidth(measure, 'recorré la exposición de collage', 150)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(150)
    expect(lines.join(' ')).toBe('recorré la exposición de collage')
  })

  it('keeps a word that is wider than a line on a line of its own, and an empty text gives no lines', () => {
    expect(wrapByWidth(measure, 'a internacionalización b', 100)).toEqual(['a', 'internacionalización', 'b'])
    expect(wrapByWidth(measure, '   ', 100)).toEqual([])
  })
})
