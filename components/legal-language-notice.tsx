import { Languages } from 'lucide-react'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'

// Legal texts stay in Spanish only (a machine translation shouldn't become
// the binding version), so other languages get this heads-up on top.
export async function LegalLanguageNotice() {
  const { locale, m } = await getI18n()
  if (!m.legal.notice) return null
  return (
    <p className="mt-6 flex gap-2 rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 px-4 py-3 text-sm text-ink" lang={locale}>
      <Languages className="mt-0.5 h-4 w-4 shrink-0 text-collage-blue" aria-hidden="true" />
      {fmt(m.legal.notice, { email: site.email })}
    </p>
  )
}
