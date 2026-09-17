import { TemplateForm } from '@/components/admin/template-form'
import { createTemplate } from '../actions'

export default async function NuevaPlantillaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">Nueva plantilla</h1>
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error === 'missing_fields' ? 'Completá nombre, asunto y cuerpo.' : error}
        </p>
      )}
      <div className="mt-8">
        <TemplateForm action={createTemplate} />
      </div>
    </div>
  )
}
