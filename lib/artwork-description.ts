import { fmt } from '@/lib/i18n/format'
import type { Messages } from '@/lib/i18n/messages'
import { countryCodeToName } from '@/lib/participants'

// «"Título", de Nombre (País) — Mundial Internacional de Collage», for search
// engines and link previews. An artist with no country yet loses the
// parentheses rather than showing empty ones.
export function artworkMetaDescription(m: Messages, locale: string, { title, name, countryCode }: { title: string; name: string; countryCode?: string }) {
  const text = fmt(m.meta.artworkDescription, { title, name, country: countryCodeToName(countryCode, locale) })
  return countryCode ? text : text.replace(/\s*\(\s*\)/, '')
}

// «Nombre · País», or just the name while the country is missing.
export function nameWithCountry(name: string, countryCode: string | undefined, locale: string) {
  return [name, countryCodeToName(countryCode, locale)].filter(Boolean).join(' · ')
}
