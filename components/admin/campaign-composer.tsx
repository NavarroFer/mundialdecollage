'use client'

import { useState } from 'react'
import { Send, FlaskConical, Languages, CalendarClock } from 'lucide-react'
import { SubmitButton } from '@/components/admin/submit-button'
import { EmailBlockEditor } from '@/components/admin/email-block-editor'
import { renderEmailDocumentToHtml, renderEmailPreviewHtml, type EmailDocument } from '@/lib/email-blocks'
import { translationState, type EmailTranslations } from '@/lib/email-translation'
import { LOCALE_INFO, LOCALES, type Locale } from '@/lib/i18n/locales'
import { formatScheduleDay, SCHEDULED_SEND_TIME_LABEL } from '@/lib/campaign-schedule'

type Template = {
  id: string
  name: string
  subject: string
  body_html: string
  body_json: EmailDocument | null
  translations: EmailTranslations | null
  translations_source: string | null
}

// Who gets which language: each contact reads their country's language when
// this email has it, Spanish otherwise.
function LanguagePlan({
  localeCounts,
  translatedInto,
  willTranslate,
  isHtml,
}: {
  localeCounts: Record<Locale, number>
  translatedInto: Locale[] | null
  willTranslate: boolean
  isHtml: boolean
}) {
  const available = new Set<Locale>(['es', ...(translatedInto ?? [])])
  const counts = new Map<Locale, number>()
  for (const locale of LOCALES) {
    const target = willTranslate || available.has(locale) ? locale : 'es'
    counts.set(target, (counts.get(target) ?? 0) + localeCounts[locale])
  }
  const rows = LOCALES.filter((locale) => (counts.get(locale) ?? 0) > 0)

  return (
    <div className="rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 p-3 text-sm text-ink">
      <p className="flex items-center gap-1.5 font-semibold">
        <Languages className="h-4 w-4 text-collage-blue" aria-hidden="true" />
        {isHtml
          ? 'Este mail está en HTML: se envía en español a todos.'
          : translatedInto
            ? 'Se envía traducido: cada contacto lo recibe en el idioma de su país.'
            : willTranslate
              ? 'Se traduce al enviar (tarda unos segundos más) y cada contacto lo recibe en el idioma de su país.'
              : 'Sin traducción: se envía en español a todos.'}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {rows.map((locale) => `${LOCALE_INFO[locale].nameEs} ${counts.get(locale)}`).join(' · ')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        El país sale del perfil del artista o del Registro; sin país, reciben español.
      </p>
    </div>
  )
}

const EMPTY_DOC: EmailDocument = { blocks: [] }

export function CampaignComposer({
  action,
  scheduleAction,
  earliestScheduleDay,
  testAction,
  templates,
  recipientCount,
  localeCounts,
  translatorConfigured,
}: {
  action: (formData: FormData) => void
  scheduleAction: (formData: FormData) => void
  earliestScheduleDay: string
  testAction: (formData: FormData) => void
  templates: Template[]
  recipientCount: number
  localeCounts: Record<Locale, number>
  translatorConfigured: boolean
}) {
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [doc, setDoc] = useState<EmailDocument>(EMPTY_DOC)
  // Campaigns built from a pre-block-editor template keep editing raw HTML —
  // there's no lossless way to turn arbitrary saved HTML into blocks.
  const [legacyHtml, setLegacyHtml] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('fernando.navarro.mdp@gmail.com')
  const [testLocale, setTestLocale] = useState<Locale>('es')
  const [scheduledFor, setScheduledFor] = useState('')

  const bodyHtml = legacyHtml ?? renderEmailDocumentToHtml(doc)
  // renderEmailDocumentToHtml always wraps in the outer table, so `bodyHtml`
  // itself is never empty even with zero blocks — check the actual content.
  const hasContent = legacyHtml !== null ? legacyHtml.trim().length > 0 : doc.blocks.length > 0

  // The chosen template's translations still apply only while its wording
  // hasn't been edited here (see translationState).
  const template = templates.find((t) => t.id === templateId)
  const translation = translationState({
    subject,
    body_json: legacyHtml !== null ? null : doc,
    translations: template?.translations,
    translations_source: template?.translations_source,
  })
  const translatedInto = translation.status === 'translated' ? translation.locales : null
  const willTranslate = !translatedInto && translation.status !== 'html' && translatorConfigured

  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (!template) return
    setSubject(template.subject)
    if (template.body_json) {
      setDoc(template.body_json)
      setLegacyHtml(null)
    } else {
      setLegacyHtml(template.body_html)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* A form can't contain another form — HTML silently drops the nested
          tag and its inputs end up submitting the outer one instead. The
          test-send form below is a sibling, not a child, of this one. */}
      <form
        action={action}
        onSubmit={(e) => {
          const scheduling = (e.nativeEvent as SubmitEvent).submitter?.id === 'schedule_submit'
          const question = scheduling
            ? `¿Programar este mail para el ${formatScheduleDay(scheduledFor)}? Se puede cancelar hasta que salga.`
            : `¿Enviar este mail a ${recipientCount} contactos suscriptos? No se puede deshacer.`
          if (!confirm(question)) e.preventDefault()
        }}
        className="space-y-4"
      >
        <input type="hidden" name="template_id" value={templateId} />

        {templates.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-ink" htmlFor="template">
              Partir de una plantilla (opcional)
            </label>
            <select
              id="template"
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink"
            >
              <option value="">— Escribir desde cero —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="subject">
            Asunto
          </label>
          <input
            id="subject"
            name="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink"
          />
        </div>

        {legacyHtml !== null ? (
          <div>
            <label className="text-sm font-semibold text-ink" htmlFor="body_html">
              Cuerpo (HTML)
            </label>
            <textarea
              id="body_html"
              name="body_html"
              required
              rows={14}
              value={legacyHtml}
              onChange={(e) => setLegacyHtml(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background p-3 font-mono text-xs text-ink"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Esta plantilla se creó con el editor de HTML — seguí editándola acá.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-ink">Cuerpo</p>
            <div className="mt-1">
              <EmailBlockEditor value={doc} onChange={setDoc} />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Se agrega automáticamente un link de baja al final — no hace falta escribirlo.
        </p>

        {hasContent && (
          <LanguagePlan
            localeCounts={localeCounts}
            translatedInto={translatedInto}
            willTranslate={willTranslate}
            isHtml={translation.status === 'html'}
          />
        )}

        <SubmitButton
          disabled={recipientCount === 0 || !subject || !hasContent}
          size="lg"
          className="gap-2 bg-collage-red text-primary-foreground hover:bg-collage-red/90"
          pendingLabel={willTranslate ? 'Traduciendo y enviando…' : 'Enviando…'}
        >
          <Send className="h-4 w-4" />
          Enviar a {recipientCount} contactos
        </SubmitButton>

        <div className="space-y-2 rounded-xl border-2 border-dashed border-ink/15 p-4">
          <label className="text-sm font-semibold text-ink" htmlFor="scheduled_for">
            O programarla para un día
          </label>
          <p className="text-xs text-muted-foreground">
            Sale ese día a las {SCHEDULED_SEND_TIME_LABEL}, a quienes estén en el público elegido en ese momento. Se
            puede cancelar desde la lista de campañas hasta entonces.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="scheduled_for"
              name="scheduled_for"
              type="date"
              min={earliestScheduleDay}
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink"
            />
            <SubmitButton
              id="schedule_submit"
              formAction={scheduleAction}
              disabled={!scheduledFor || scheduledFor < earliestScheduleDay || !subject || !hasContent}
              variant="outline"
              className="gap-2"
              pendingLabel={willTranslate ? 'Traduciendo y programando…' : 'Programando…'}
            >
              <CalendarClock className="h-4 w-4" />
              Programar
            </SubmitButton>
          </div>
        </div>
      </form>

      <div>
        <p className="text-sm font-semibold text-ink">Vista previa</p>
        <div className="mt-1 h-full min-h-[400px] overflow-auto rounded-xl border-2 border-ink/15 bg-white p-4">
          <div
            dangerouslySetInnerHTML={{
              __html: bodyHtml ? renderEmailPreviewHtml(bodyHtml) : '<p style="color:#999">Escribí el cuerpo para ver la vista previa acá.</p>',
            }}
          />
        </div>
      </div>

      <form
        action={testAction}
        className="space-y-2 rounded-xl border-2 border-dashed border-ink/15 p-4 md:col-span-2"
      >
        <p className="text-sm font-semibold text-ink">Mandar una prueba antes</p>
        <p className="text-xs text-muted-foreground">
          Envía este asunto y cuerpo a una sola dirección — no crea una campaña ni cuenta como enviada.
        </p>
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="body_html" value={bodyHtml} />
        {legacyHtml === null && <input type="hidden" name="body_json" value={JSON.stringify(doc)} />}
        <input type="hidden" name="template_id" value={templateId} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="test_locale">
            Idioma de la prueba
          </label>
          <select
            id="test_locale"
            name="test_locale"
            value={testLocale}
            onChange={(e) => setTestLocale(e.target.value as Locale)}
            disabled={legacyHtml !== null}
            className="rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {LOCALE_INFO[locale].nameEs}
              </option>
            ))}
          </select>
          <input
            type="email"
            name="test_email"
            required
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink"
          />
          <SubmitButton
            disabled={!subject || !hasContent}
            variant="outline"
            className="gap-2"
            pendingLabel="Enviando…"
          >
            <FlaskConical className="h-4 w-4" />
            Enviar prueba
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
