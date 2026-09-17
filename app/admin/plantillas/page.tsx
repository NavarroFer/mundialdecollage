import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deleteTemplate } from './actions'

export default async function PlantillasPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, subject, updated_at')
    .order('updated_at', { ascending: false })

  const list = templates ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-tight text-ink uppercase">Plantillas</h1>
        <Link
          href="/admin/plantillas/nueva"
          className="rounded-full bg-collage-blue px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Nueva plantilla
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {list.length === 0 && (
          <p className="text-muted-foreground">Todavía no creaste ninguna plantilla.</p>
        )}
        {list.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-card px-5 py-4"
          >
            <div>
              <p className="font-semibold text-ink">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.subject}</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/admin/plantillas/${t.id}`} className="text-sm font-semibold text-collage-blue hover:underline">
                Editar
              </Link>
              <form action={deleteTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-sm font-semibold text-collage-red hover:underline">
                  Borrar
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
