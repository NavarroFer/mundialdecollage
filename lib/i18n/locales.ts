// Languages the public site and campaign mails come in. Spanish is the
// source every other one is translated from; the rest cover the countries
// our participants come from (see data/artist-country-stats.json).
// Kept free of `@/` imports so plain Node scripts can load it too.
export const LOCALES = ['es', 'en', 'pt', 'it', 'fr', 'de', 'ru', 'pl', 'id'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

// Every locale except the Spanish source — what gets machine-translated.
export const TRANSLATED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE) as Exclude<Locale, 'es'>[]

// Set by the language switcher (and by ?lang= links); outranks detection.
export const LOCALE_COOKIE = 'mdc-locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export const LOCALE_INFO: Record<
  Locale,
  {
    /** The language's own name, for the switcher. */
    name: string
    /** Its Spanish name, for the admin panel. */
    nameEs: string
    /** BCP 47 tag used for dates, numbers and plural rules. */
    intl: string
    /** Open Graph locale. */
    og: string
    /** Where it's read, in Spanish, for the admin's "traducida en" tooltip. */
    countriesEs: string
  }
> = {
  es: { name: 'Español', nameEs: 'Español', intl: 'es-AR', og: 'es_AR', countriesEs: 'Argentina, España, México, Chile, Colombia y el resto de Hispanoamérica' },
  en: { name: 'English', nameEs: 'Inglés', intl: 'en-US', og: 'en_US', countriesEs: 'Estados Unidos, Canadá, Reino Unido y cualquier país sin idioma propio en la lista' },
  pt: { name: 'Português', nameEs: 'Portugués', intl: 'pt-BR', og: 'pt_BR', countriesEs: 'Brasil, Portugal, Angola, Mozambique' },
  it: { name: 'Italiano', nameEs: 'Italiano', intl: 'it-IT', og: 'it_IT', countriesEs: 'Italia, San Marino' },
  fr: { name: 'Français', nameEs: 'Francés', intl: 'fr-FR', og: 'fr_FR', countriesEs: 'Francia, Bélgica, Luxemburgo, Mónaco, Haití y África francófona' },
  de: { name: 'Deutsch', nameEs: 'Alemán', intl: 'de-DE', og: 'de_DE', countriesEs: 'Alemania, Austria, Suiza, Liechtenstein' },
  ru: { name: 'Русский', nameEs: 'Ruso', intl: 'ru-RU', og: 'ru_RU', countriesEs: 'Rusia, Bielorrusia, Kazajistán, Kirguistán' },
  pl: { name: 'Polski', nameEs: 'Polaco', intl: 'pl-PL', og: 'pl_PL', countriesEs: 'Polonia' },
  id: { name: 'Bahasa Indonesia', nameEs: 'Indonesio', intl: 'id-ID', og: 'id_ID', countriesEs: 'Indonesia' },
}

// ISO 3166-1 alpha-2 → language. Switzerland gets German (the majority
// language); Swiss visitors whose browser asks for French or Italian get
// those instead, since the browser language is checked first.
const COUNTRY_LOCALE: Record<string, Locale> = {
  ...Object.fromEntries(
    ['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GQ', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE'].map((c) => [c, 'es']),
  ),
  ...Object.fromEntries(['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL'].map((c) => [c, 'pt'])),
  ...Object.fromEntries(['IT', 'SM', 'VA'].map((c) => [c, 'it'])),
  ...Object.fromEntries(
    ['FR', 'BE', 'LU', 'MC', 'HT', 'SN', 'CI', 'CM', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GA', 'CG', 'CD', 'MG'].map((c) => [c, 'fr']),
  ),
  ...Object.fromEntries(['DE', 'AT', 'CH', 'LI'].map((c) => [c, 'de'])),
  ...Object.fromEntries(['RU', 'BY', 'KZ', 'KG'].map((c) => [c, 'ru'])),
  PL: 'pl',
  ID: 'id',
}

/**
 * The language for someone from `countryCode`. A real country without its own
 * language here reads English; no country at all is `undefined` so callers can
 * pick their own fallback (Spanish, for this mostly Latin American community).
 */
export function localeForCountry(countryCode: string | null | undefined): Locale | undefined {
  const code = countryCode?.trim().toUpperCase()
  if (!code || !/^[A-Z]{2}$/.test(code)) return undefined
  return COUNTRY_LOCALE[code] ?? 'en'
}

/** Supported languages in an Accept-Language header, most preferred first. */
export function localesFromAcceptLanguage(header: string | null | undefined): Locale[] {
  if (!header) return []
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const quality = q ? Number(q.slice(2)) : 1
      return { language: tag.trim().toLowerCase().split('-')[0], quality: Number.isFinite(quality) ? quality : 0, index }
    })
    .filter((entry) => entry.language && entry.language !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
  const found: Locale[] = []
  for (const { language } of ranked) {
    if (isLocale(language) && !found.includes(language)) found.push(language)
  }
  return found
}

/**
 * Picks the reader's language: an explicit choice (cookie) first, then what
 * their browser asks for, then the country Vercel geolocated them to, then
 * Spanish. The browser comes before the country so an Argentine living in
 * Italy still reads Spanish.
 */
export function resolveLocale({
  cookie,
  acceptLanguage,
  country,
}: {
  cookie?: string | null
  acceptLanguage?: string | null
  country?: string | null
}): Locale {
  if (isLocale(cookie)) return cookie
  return localesFromAcceptLanguage(acceptLanguage)[0] ?? localeForCountry(country) ?? DEFAULT_LOCALE
}
