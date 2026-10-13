'use client'

import { Download } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { TERMS_PDF_URL, TERMS_VERSION } from '@/lib/terms-version'

// Casilla obligatoria para aceptar los Términos y Condiciones antes de enviar
// o confirmar una obra. El server action vuelve a chequear `accept_terms` y
// guarda la versión aceptada en terms_acceptances.
export function TermsCheckbox({ id = 'accept_terms' }: { id?: string }) {
  const { m } = useI18n()
  const [before, after = ''] = m.terms.accept.split('{link}')
  return (
    <div className="rounded-xl border-2 border-ink/15 bg-paper p-4">
      <input type="hidden" name="terms_version" value={TERMS_VERSION} />
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-ink">
        <input
          id={id}
          name="accept_terms"
          type="checkbox"
          required
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-collage-blue"
        />
        <span>
          {before}
          <a
            href="/terminos-y-condiciones"
            target="_blank"
            rel="noopener"
            className="font-semibold text-collage-blue underline underline-offset-4"
          >
            {m.terms.link}
          </a>
          {after}
        </span>
      </label>
      <a
        href={TERMS_PDF_URL}
        download
        className="mt-2 ml-8 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
      >
        <Download className="size-4" aria-hidden="true" />
        {m.terms.downloadPdf}
      </a>
    </div>
  )
}
