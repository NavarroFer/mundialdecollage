import Link from 'next/link'
import { Plus, Pencil, Trash2, Copy, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { TranslationBadge } from '@/components/admin/translation-badge'
import { translationState } from '@/lib/email-translation'
import { isTranslatorConfigured } from '@/lib/email-translator'
import { ensureSystemTemplate, isSystemTemplateKey, SYSTEM_TEMPLATES } from '@/lib/system-templates'
import { deleteTemplate, duplicateTemplate, translateTemplate } from './actions'
import { adminDescription } from '@/components/admin/admin-sections'

// Translating a template into eight languages takes a little while.
export const maxDuration = 120

export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  // The automatic mails' templates are created on first sight, so they can
  // be reviewed and edited before the cron ever sends them.
  await Promise.all(Object.keys(SYSTEM_TEMPLATES).map((key) =>
    isSystemTemplateKey(key) && ensureSystemTemplate(supabase, key).catch((err) => console.error(`ensureSystemTemplate(${key}) failed:`, err)),
  ))
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, subject, updated_at, body_json, translations, translations_source, system_key')
    .order('updated_at', { ascending: false })

  const list = (templates ?? []).map((t) => ({ ...t, translation: translationState(t) }))

  return (
    <div>
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Plantillas"
        description={adminDescription('/admin/plantillas')}
        action={
          <Link href="/admin/plantillas/nueva">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          </Link>
        }
      />

      {!isTranslatorConfigured && (
        <p className="mt-4 rounded-xl border-2 border-collage-yellow/50 bg-collage-yellow/15 px-4 py-3 text-sm text-ink">
          Las plantillas se traducen solas al guardarlas una vez que esté configurada ANTHROPIC_API_KEY en Vercel.
          Mientras tanto, las que no tengan traducción se envían en español a todos.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-3">
        {list.length === 0 && (
          <p className="text-muted-foreground">Todavía no creaste ninguna plantilla.</p>
        )}
        {list.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-card px-5 py-4"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.subject}</p>
              {isSystemTemplateKey(t.system_key) && (
                <p className="mt-1 text-sm text-ink">{SYSTEM_TEMPLATES[t.system_key].description}</p>
              )}
              <div className="mt-2">
                <TranslationBadge status={t.translation.status} locales={t.translation.locales} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isTranslatorConfigured && (t.translation.status === 'untranslated' || t.translation.status === 'outdated') && (
                <form action={translateTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Traduciendo…">
                    <Languages className="h-3.5 w-3.5" />
                    Traducir
                  </SubmitButton>
                </form>
              )}
              <Link href={`/admin/plantillas/${t.id}`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              </Link>
              <form action={duplicateTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Duplicando…">
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar
                </SubmitButton>
              </form>
              {!t.system_key && (
                <form action={deleteTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-collage-red hover:bg-collage-red/10 hover:text-collage-red"
                    pendingLabel="Borrando…"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
