import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateForm } from '@/components/admin/template-form'
import { updateTemplate } from '../actions'

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
    .select('id, name, subject, body_html')
    .eq('id', id)
    .maybeSingle()

  if (!template) notFound()

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">Editar plantilla</h1>
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error === 'missing_fields' ? 'Completá nombre, asunto y cuerpo.' : error}
        </p>
      )}
      <div className="mt-8">
        <TemplateForm action={updateTemplate} defaultValues={template} />
      </div>
    </div>
  )
}
