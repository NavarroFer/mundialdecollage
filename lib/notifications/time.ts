import { formatDayMonth } from '@/lib/i18n/format'
import { LOCALE_INFO, type Locale } from '@/lib/i18n/locales'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * When a notice last changed, the way the bell shows it: "ahora",
 * "hace 5 min", "ayer"… and the plain date after a week.
 */
export function relativeTime(locale: Locale, iso: string, now: Date): string {
  // A clock slightly ahead of the server's shouldn't read "en 1 minuto".
  const seconds = Math.min(0, Math.round((new Date(iso).getTime() - now.getTime()) / 1000))
  const elapsed = -seconds
  if (elapsed >= WEEK) return formatDayMonth(locale, iso)

  const format = new Intl.RelativeTimeFormat(LOCALE_INFO[locale].intl, { numeric: 'auto' })
  if (elapsed < MINUTE) return format.format(0, 'second')
  if (elapsed < HOUR) return format.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return format.format(-Math.floor(elapsed / HOUR), 'hour')
  return format.format(-Math.floor(elapsed / DAY), 'day')
}
