import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  sending: 'Enviando…',
  sent: 'Enviada',
  failed: 'Falló',
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; failed?: string }>
}) {
  const { sent, failed } = await searchParams
  const supabase = await createClient()
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, subject, status, recipient_count, sent_count, failed_count, sent_at, created_at')
    .order('created_at', { ascending: false })

  const list = campaigns ?? []

  return (
    <div>
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Campañas"
        action={
          <Link href="/admin/campanas/nueva">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva campaña
            </Button>
          </Link>
        }
      />

      {sent && (
        <p className="mt-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          Enviada a {sent} contactos{Number(failed) > 0 ? ` (${failed} fallaron)` : ''}.
        </p>
      )}

      <div className="mt-8 space-y-3">
        {list.length === 0 && <p className="text-muted-foreground">Todavía no mandaste ninguna campaña.</p>}
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl border-2 border-ink/10 bg-card px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">{c.subject}</p>
              <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {statusLabel[c.status] ?? c.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {c.recipient_count} destinatarios · {c.sent_count} enviados
              {c.failed_count > 0 ? ` · ${c.failed_count} fallaron` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
