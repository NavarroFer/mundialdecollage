import { LOCALE_INFO, type Locale } from './locales'

// Plural forms keyed by Intl.PluralRules category. Spanish only needs
// one/other; Russian and Polish also use few/many.
export type Plural = { other: string } & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>

// Marks a message as plural so every locale's dictionary can carry the
// categories its language needs under the same key.
export function p(forms: Plural): Plural {
  return forms
}

/** Fills `{name}` placeholders. Unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

/** Picks the plural form for `count` and fills `{count}` plus any `vars`. */
export function plural(locale: Locale, count: number, forms: Plural, vars: Record<string, string | number> = {}): string {
  const category = new Intl.PluralRules(LOCALE_INFO[locale].intl).select(count)
  return fmt(forms[category] ?? forms.other, { count: formatNumber(locale, count), ...vars })
}

export function formatNumber(locale: Locale, value: number): string {
  return value.toLocaleString(LOCALE_INFO[locale].intl)
}

// Dates are about the contest in Argentina, so they're shown in its timezone.
export function formatDayMonth(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

// Whole amounts only ("$ 30.000", "US$ 15"): prices are set in round numbers.
export function formatMoney(locale: Locale, value: number, currency: 'ARS' | 'USD'): string {
  return new Intl.NumberFormat(LOCALE_INFO[locale].intl, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}
