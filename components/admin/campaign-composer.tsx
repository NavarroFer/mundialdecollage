'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { SubmitButton } from '@/components/admin/submit-button'

type Template = { id: string; name: string; subject: string; body_html: string }

export function CampaignComposer({
  action,
  templates,
  recipientCount,
}: {
  action: (formData: FormData) => void
  templates: Template[]
  recipientCount: number
}) {
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')

  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) {
      setSubject(template.subject)
      setBodyHtml(template.body_html)
    }
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Enviar este mail a ${recipientCount} contactos suscriptos? No se puede deshacer.`)) {
          e.preventDefault()
        }
      }}
      className="grid gap-6 md:grid-cols-2"
    >
      <input type="hidden" name="template_id" value={templateId} />

      <div className="space-y-4">
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

        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="body_html">
            Cuerpo (HTML)
          </label>
          <textarea
            id="body_html"
            name="body_html"
            required
            rows={14}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background p-3 font-mono text-xs text-ink"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se agrega automáticamente un link de baja al final — no hace falta escribirlo.
          </p>
        </div>

        <SubmitButton
          disabled={recipientCount === 0}
          size="lg"
          className="gap-2 bg-collage-red text-primary-foreground hover:bg-collage-red/90"
          pendingLabel="Enviando…"
        >
          <Send className="h-4 w-4" />
          Enviar a {recipientCount} contactos
        </SubmitButton>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Vista previa</p>
        <div className="mt-1 h-full min-h-[400px] overflow-auto rounded-xl border-2 border-ink/15 bg-white p-4">
          <div
            dangerouslySetInnerHTML={{
              __html: bodyHtml || '<p style="color:#999">Escribí el cuerpo para ver la vista previa acá.</p>',
            }}
          />
        </div>
      </div>
    </form>
  )
}
