import type { Locale } from '../locales'
import es, { type Messages } from './es'
import en from './en'
import pt from './pt'
import it from './it'
import fr from './fr'
import de from './de'
import ru from './ru'
import pl from './pl'
import id from './id'

// Server-side only: client components get their slice through I18nProvider
// (see ./client.ts) instead of bundling all nine dictionaries.
export const MESSAGES: Record<Locale, Messages> = { es, en, pt, it, fr, de, ru, pl, id }

export type { Messages }
