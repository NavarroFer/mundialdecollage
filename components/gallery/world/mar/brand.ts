// The Mundial de Collage's identity (September 2026 brand guide), as the 3D
// signs use it: the same five hex values app/globals.css defines, the site's
// display face (Anton) and the torn-paper motif. brand.test.ts reads the
// stylesheet, so if the guide's values change the signs fail loudly instead
// of quietly drifting.

export const BRAND = {
  paper: '#faf8f2',
  ink: '#1b110c',
  blue: '#11458c',
  red: '#d4302e',
  yellow: '#e79d00',
} as const

/** The site's address, as printed on the banners. */
export const BRAND_DOMAIN = 'mundialdecollage.com.ar'

/** Splits `text` into lines no wider than `maxWidth`, by the width `measure` reports; a word wider than a line gets its own. */
export function wrapByWidth(measure: (text: string) => number, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (!current || measure(next) <= maxWidth) current = next
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}
