import { Languages } from 'lucide-react'
import { LOCALE_INFO, TRANSLATED_LOCALES, type Locale } from '@/lib/i18n/locales'
import type { TranslatedLocale, TranslationStatus } from '@/lib/email-translation'
import { cn } from '@/lib/utils'

// "Traducida en 8 idiomas", with the languages and the countries that get
// each one in a popover on hover or keyboard focus (plain CSS, so it also
// works in server-rendered lists).
export function TranslationBadge({
  status,
  locales,
}: {
  status: TranslationStatus
  locales: TranslatedLocale[]
}) {
  const label =
    status === 'translated'
      ? `Traducida en ${locales.length} ${locales.length === 1 ? 'idioma' : 'idiomas'}`
      : status === 'outdated'
        ? 'Traducción desactualizada'
        : status === 'html'
          ? 'Solo español (HTML)'
          : 'Sin traducir'

  const shown: Locale[] = status === 'translated' ? ['es', ...locales] : ['es']
  const missing = status === 'translated' ? TRANSLATED_LOCALES.filter((locale) => !locales.includes(locale)) : []

  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-collage-blue',
          status === 'translated' && 'bg-collage-blue/10 text-collage-blue',
          status === 'outdated' && 'bg-collage-yellow/30 text-ink',
          (status === 'untranslated' || status === 'html') && 'bg-ink/5 text-muted-foreground',
        )}
      >
        <Languages className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-0 z-30 mt-2 w-80 rounded-xl border-2 border-ink/10 bg-card p-3 text-left text-xs text-ink opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <span className="mb-2 block font-semibold">Cada contacto recibe el idioma de su país:</span>
        <span className="block space-y-1.5">
          {shown.map((locale) => (
            <span key={locale} className="block">
              <span className="font-semibold">{LOCALE_INFO[locale].nameEs}</span>
              {locale === 'es' && ' (original)'}
              <span className="block text-muted-foreground">{LOCALE_INFO[locale].countriesEs}</span>
            </span>
          ))}
        </span>
        {status === 'outdated' && (
          <span className="mt-2 block text-muted-foreground">
            Cambiaste el texto después de traducirla: hasta volver a traducirla, se envía en español a todos.
          </span>
        )}
        {status === 'untranslated' && (
          <span className="mt-2 block text-muted-foreground">Hasta traducirla, se envía en español a todos.</span>
        )}
        {status === 'html' && (
          <span className="mt-2 block text-muted-foreground">
            Las plantillas hechas en HTML no se traducen. Recreala con el editor de bloques para traducirla.
          </span>
        )}
        {missing.length > 0 && (
          <span className="mt-2 block text-muted-foreground">
            Sin traducir: {missing.map((locale) => LOCALE_INFO[locale].nameEs).join(', ')} (reciben español).
          </span>
        )}
      </span>
    </span>
  )
}
