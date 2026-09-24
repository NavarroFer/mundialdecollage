import { plural } from '@/lib/i18n/format'
import type { Locale } from '@/lib/i18n/locales'
import type { Messages } from '@/lib/i18n/messages/es'

type PresenceMessages = Messages['gallery']['presence']

// `count` always includes the viewer once they're inside, so 0 can only show
// up for a moment before their own presence syncs — treat it as "just you".
export function insideLabel(count: number, locale: Locale, m: PresenceMessages): string {
  return count <= 1 ? m.alone : plural(locale, count, m.inside)
}

// Other visitors with the same artwork open — never counts the viewer.
export function viewersLabel(others: number, locale: Locale, m: PresenceMessages): string | null {
  if (others <= 0) return null
  return plural(locale, others, m.viewers)
}

// Before entering, the viewer isn't counted yet: every person here is someone
// else. Nothing is shown for an empty room rather than advertising it.
export function waitingLabel(count: number, locale: Locale, m: PresenceMessages): string | null {
  if (count <= 0) return null
  return plural(locale, count, m.waiting)
}
