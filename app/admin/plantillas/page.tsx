import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'
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
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Plantillas"
        action={
          <Link href="/admin/plantillas/nueva">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          </Link>
        }
      />

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
            <div className="flex items-center gap-2">
              <Link href={`/admin/plantillas/${t.id}`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              </Link>
              <form action={deleteTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-collage-red hover:bg-collage-red/10 hover:text-collage-red"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
