import Link from 'next/link'
import { Circle, CircleAlert, CircleCheck, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'

const STATUS: Record<string, { label: string; icon: typeof Circle; className: string; spin?: boolean }> = {
  draft: { label: 'Borrador', icon: Circle, className: 'bg-ink/10 text-muted-foreground' },
  sending: { label: 'Enviando…', icon: Loader2, className: 'bg-collage-yellow/15 text-collage-yellow', spin: true },
  sent: { label: 'Enviada', icon: CircleCheck, className: 'bg-collage-blue/15 text-collage-blue' },
  failed: { label: 'Falló', icon: CircleAlert, className: 'bg-collage-red/15 text-collage-red' },
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; failed?: string; error?: string }>
}) {
  const { sent, failed, error } = await searchParams
  const supabase = await createClient()
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      'id, subject, status, recipient_count, sent_count, failed_count, delivered_count, opened_count, bounced_count, sent_at, created_at',
    )
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
        <p
          className={`mt-4 rounded-xl border-2 px-4 py-3 text-sm text-ink ${
            Number(sent) === 0
              ? 'border-collage-red/30 bg-collage-red/10'
              : 'border-collage-blue/30 bg-collage-blue/10'
          }`}
        >
          {Number(sent) === 0
            ? `Falló el envío (${failed} fallaron).`
            : `Enviada a ${sent} contactos${Number(failed) > 0 ? ` (${failed} fallaron)` : ''}.`}
          {error && <span className="mt-1 block text-xs text-muted-foreground">Error: {error}</span>}
        </p>
      )}

      <div className="mt-8 space-y-3">
        {list.length === 0 && <p className="text-muted-foreground">Todavía no mandaste ninguna campaña.</p>}
        {list.map((c) => {
          const status = STATUS[c.status] ?? {
            label: c.status,
            icon: Circle,
            className: 'bg-ink/10 text-muted-foreground',
          }
          const StatusIcon = status.icon
          return (
            <div key={c.id} className="rounded-2xl border-2 border-ink/10 bg-card px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{c.subject}</p>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${status.className}`}
                >
                  <StatusIcon className={`h-3.5 w-3.5 ${status.spin ? 'animate-spin' : ''}`} />
                  {status.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.recipient_count} destinatarios · {c.sent_count} enviados
                {c.delivered_count > 0 ? ` · ${c.delivered_count} entregados` : ''}
                {c.opened_count > 0 ? ` · ${c.opened_count} abiertos` : ''}
                {c.bounced_count > 0 ? ` · ${c.bounced_count} rebotaron` : ''}
                {c.failed_count > 0 ? ` · ${c.failed_count} fallaron` : ''}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
