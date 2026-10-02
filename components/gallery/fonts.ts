// For text drawn on a <canvas> (the souvenir photo, the collage's plaque):
// next/font hashes the family names, so the CSS variables on <html> carry
// them. Anton has no Cyrillic, so Russian uses the same fallback as the site.
export function canvasFonts(cyrillic: boolean) {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    display: read(cyrillic ? '--font-display-cyrillic' : '--font-anton', 'Impact, sans-serif'),
    body: read('--font-geist-sans', 'sans-serif'),
  }
}
