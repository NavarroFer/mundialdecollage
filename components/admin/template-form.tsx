'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { SubmitButton } from '@/components/admin/submit-button'
import { EmailBlockEditor } from '@/components/admin/email-block-editor'
import { createDefaultEmailDocument, renderEmailDocumentToHtml, type EmailDocument } from '@/lib/email-blocks'
import { TRANSLATED_LOCALES } from '@/lib/i18n/locales'

export function TemplateForm({
  action,
  defaultValues,
  translates = false,
}: {
  action: (formData: FormData) => void
  // Whether saving also translates it (lib/email-translator.ts is configured).
  translates?: boolean
  defaultValues?: {
    id?: string
    name: string
    subject: string
    body_html: string
    body_json?: EmailDocument | null
  }
}) {
  // Templates saved before the visual editor only have body_html — they keep
  // opening in the old raw-HTML textarea instead of trying to reverse-parse
  // arbitrary HTML into blocks. Anything new starts from the block editor.
  const isLegacyHtml = Boolean(defaultValues) && !defaultValues?.body_json
  const [doc, setDoc] = useState<EmailDocument>(defaultValues?.body_json ?? createDefaultEmailDocument())
  const [legacyHtml, setLegacyHtml] = useState(defaultValues?.body_html ?? '')

  const previewHtml = isLegacyHtml ? legacyHtml : renderEmailDocumentToHtml(doc)

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

        {isLegacyHtml ? (
          <div>
            <label className="text-sm font-semibold text-ink" htmlFor="body_html">
              Cuerpo (HTML)
            </label>
            <textarea
              id="body_html"
              name="body_html"
              required
              rows={16}
              value={legacyHtml}
              onChange={(e) => setLegacyHtml(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-background p-3 font-mono text-xs text-ink"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Esta plantilla se creó con el editor de HTML — seguí editándola acá. Las plantillas nuevas usan el
              editor visual de bloques.
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
          Se agrega automáticamente un link de baja al final de cada envío — no hace falta escribirlo acá.
        </p>

        {translates && !isLegacyHtml && (
          <p className="text-xs text-muted-foreground">
            Al guardar, se traduce sola a {TRANSLATED_LOCALES.length} idiomas y cada contacto la recibe en el de su país.
            Si solo cambiás imágenes o links, las traducciones se mantienen.
          </p>
        )}

        <SubmitButton className="gap-2" pendingLabel={translates && !isLegacyHtml ? 'Guardando y traduciendo…' : 'Guardando…'}>
          <Save className="h-4 w-4" />
          Guardar plantilla
        </SubmitButton>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Vista previa</p>
        <div className="mt-1 h-full min-h-[400px] overflow-auto rounded-xl border-2 border-ink/15 bg-white p-4">
          <div
            dangerouslySetInnerHTML={{
              __html: previewHtml || '<p style="color:#999">Agregá bloques para ver la vista previa acá.</p>',
            }}
          />
        </div>
      </div>
    </form>
  )
}
