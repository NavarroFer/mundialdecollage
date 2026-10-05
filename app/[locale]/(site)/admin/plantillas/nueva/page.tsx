import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TemplateForm } from '@/components/admin/template-form'
import { AdminPageHeader } from '@/components/admin/page-header'
import { createTemplate } from '../actions'
import { isTranslatorConfigured } from '@/lib/email-translator'

// Saving translates the template into eight languages, which takes a little while.
export const maxDuration = 120

export default async function NuevaPlantillaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div>
      <Link
        href="/admin/plantillas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantillas
      </Link>
      <AdminPageHeader eyebrow="Newsletter" title="Nueva plantilla" />
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error === 'missing_fields' ? 'Completá nombre, asunto y cuerpo.' : error}
        </p>
      )}
      <div className="mt-8">
        <TemplateForm action={createTemplate} translates={isTranslatorConfigured} />
      </div>
    </div>
  )
}
