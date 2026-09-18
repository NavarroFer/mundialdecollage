'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { SubmitButton } from '@/components/admin/submit-button'

export function TemplateForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => void
  defaultValues?: { id?: string; name: string; subject: string; body_html: string }
}) {
  const [bodyHtml, setBodyHtml] = useState(defaultValues?.body_html ?? '')

  return (
    <form action={action} className="grid gap-6 md:grid-cols-2">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="name">
            Nombre interno
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={defaultValues?.name}
            placeholder="Recordatorio de cierre"
            className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="subject">
            Asunto
          </label>
          <input
            id="subject"
            name="subject"
            required
            defaultValue={defaultValues?.subject}
            placeholder="Quedan pocos días para el Mundial de Collage"
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
            rows={16}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background p-3 font-mono text-xs text-ink"
            placeholder="<p>Hola {{nombre}},</p>"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se agrega automáticamente un link de baja al final de cada envío — no hace falta escribirlo acá.
          </p>
        </div>

        <SubmitButton className="gap-2" pendingLabel="Guardando…">
          <Save className="h-4 w-4" />
          Guardar plantilla
        </SubmitButton>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Vista previa</p>
        <div className="mt-1 h-full min-h-[400px] overflow-auto rounded-xl border-2 border-ink/15 bg-white p-4">
          <div dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#999">Escribí el cuerpo para ver la vista previa acá.</p>' }} />
        </div>
      </div>
    </form>
  )
}
