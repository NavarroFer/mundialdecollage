import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TemplateForm } from '@/components/admin/template-form'
import { AdminPageHeader } from '@/components/admin/page-header'
import { updateTemplate } from '../actions'
import { isTranslatorConfigured } from '@/lib/email-translator'
import { translationState } from '@/lib/email-translation'
import { TranslationBadge } from '@/components/admin/translation-badge'

// Saving translates the template into eight languages, which takes a little while.
export const maxDuration = 120

export default async function EditarPlantillaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: template } = await supabase
    .from('templates')
    .select('id, name, subject, body_html, body_json, translations, translations_source, audiences')
    .eq('id', id)
    .maybeSingle()

  if (!template) notFound()

  return (
    <div>
      <Link
        href="/admin/plantillas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantillas
      </Link>
      <AdminPageHeader eyebrow="Newsletter" title="Editar plantilla" />
      <div className="mt-3">
        <TranslationBadge {...translationState(template)} />
      </div>
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error === 'missing_fields' ? 'Completá nombre, asunto y cuerpo.' : error}
        </p>
      )}
      <div className="mt-8">
        <TemplateForm action={updateTemplate} defaultValues={template} translates={isTranslatorConfigured} />
      </div>
    </div>
  )
}
