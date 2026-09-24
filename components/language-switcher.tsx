'use client'

import { Languages } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { LOCALE_COOKIE, LOCALE_INFO, LOCALES, type Locale } from '@/lib/i18n/locales'
import { cn } from '@/lib/utils'

// The reader's explicit choice, stored in the same cookie proxy.ts sets for
// ?lang= links. A full reload (rather than router.refresh) so no page cached
// in the client router keeps showing the previous language.
function chooseLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  window.location.reload()
}

// A native <select> (keyboard and screen-reader friendly for free), laid
// invisibly over a compact "🌐 ES" so it doesn't crowd the header.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, m } = useI18n()

  return (
    <label
      className={cn(
        'relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-ink/70 hover:text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-collage-blue',
        className,
      )}
      title={m.language.change}
    >
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{locale.toUpperCase()}</span>
      <select
        value={locale}
        onChange={(event) => chooseLocale(event.target.value as Locale)}
        aria-label={m.language.change}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={option}>
            {LOCALE_INFO[option].name}
          </option>
        ))}
      </select>
    </label>
  )
}
