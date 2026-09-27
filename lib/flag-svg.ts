import * as flags from 'country-flag-icons/string/3x2'

// Emoji flags need an OS font that has them (Windows has none, so it shows
// the bare letters), so flags are drawn as real SVGs instead. Server-side
// only: import this from server code and hand the SVG strings down, to keep
// the ~1.6MB flag set out of the browser.
export function flagSvg(countryCode: string): string | null {
  return (flags as Record<string, string | undefined>)[countryCode.toUpperCase()] ?? null
}

// The SVG of each distinct country among these codes, keyed by upper-case
// code — one copy per country however many obras share it.
export function flagSvgsFor(countryCodes: string[]): Record<string, string> {
  const svgs: Record<string, string> = {}
  for (const code of countryCodes) {
    const key = code.toUpperCase()
    if (key in svgs) continue
    const svg = flagSvg(key)
    if (svg) svgs[key] = svg
  }
  return svgs
}
