import Link from 'next/link'
import { CalendarClock, Circle, CircleAlert, CircleCheck, CircleSlash, Loader2, Plus, RotateCw, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { cancelScheduledCampaign, retryFailedSends } from './actions'
import { formatScheduleDay, SCHEDULED_SEND_TIME_LABEL } from '@/lib/campaign-schedule'
import { audienceLabel } from '@/lib/campaign-audience'
import { adminDescription } from '@/components/admin/admin-sections'

const STATUS: Record<string, { label: string; icon: typeof Circle; className: string; spin?: boolean }> = {
  draft: { label: 'Borrador', icon: Circle, className: 'bg-ink/10 text-muted-foreground' },
  scheduled: { label: 'Programada', icon: CalendarClock, className: 'bg-collage-blue/15 text-collage-blue' },
  canceled: { label: 'Cancelada', icon: CircleSlash, className: 'bg-ink/10 text-muted-foreground' },
  sending: { label: 'Enviando…', icon: Loader2, className: 'bg-collage-yellow/15 text-collage-yellow', spin: true },
  sent: { label: 'Enviada', icon: CircleCheck, className: 'bg-collage-blue/15 text-collage-blue' },
  failed: { label: 'Falló', icon: CircleAlert, className: 'bg-collage-red/15 text-collage-red' },
}

function formatCampaignDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(value))
}

function rate(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : null
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string
    retried?: string
    skipped?: string
    failed?: string
    scheduled?: string
    canceled?: string
    error?: string
  }>
}) {
  const { sent, retried, skipped, failed, scheduled, canceled, error } = await searchParams
  const supabase = await createClient()
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      'id, subject, status, audience, scheduled_for, recipient_count, sent_count, failed_count, delivered_count, opened_count, clicked_count, bounced_count, complained_count, sent_at, created_at',
    )
    .order('created_at', { ascending: false })

  const list = campaigns ?? []

  return (
    <div>
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Campañas"
        description={adminDescription('/admin/campanas')}
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

      {(scheduled || canceled) && (
        <p className="mt-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          {scheduled
            ? `Programada para el ${formatScheduleDay(scheduled)} a las ${SCHEDULED_SEND_TIME_LABEL}.`
            : 'Campaña programada cancelada.'}
          {error && <span className="mt-1 block text-xs text-muted-foreground">{error}</span>}
        </p>
      )}

      {!sent && !scheduled && !canceled && (retried || error) && (
        <p
          className={`mt-4 rounded-xl border-2 px-4 py-3 text-sm text-ink ${
            !retried || Number(retried) === 0
              ? 'border-collage-red/30 bg-collage-red/10'
              : 'border-collage-blue/30 bg-collage-blue/10'
          }`}
        >
          {retried &&
            `Reenviada a ${retried} de los que fallaron${Number(failed) > 0 ? ` (${failed} volvieron a fallar)` : ''}${
              Number(skipped) > 0 ? ` · ${skipped} salteados (dados de baja, borrados o con email inválido)` : ''
            }.`}
          {error && (
            <span className={retried ? 'mt-1 block text-xs text-muted-foreground' : ''}>Error: {error}</span>
          )}
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
          const sentDate = formatCampaignDate(c.sent_at)
          const deliveryRate = rate(c.delivered_count, c.sent_count)
          const openRate = rate(c.opened_count, c.delivered_count || c.sent_count)
          const clickRate = rate(c.clicked_count, c.delivered_count || c.sent_count)
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
              {c.status === 'scheduled' || c.status === 'canceled' ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.status === 'scheduled' ? 'Sale el' : 'Iba a salir el'} {formatScheduleDay(c.scheduled_for)}
                  {c.status === 'scheduled' ? ` a las ${SCHEDULED_SEND_TIME_LABEL}` : ''} · {audienceLabel(c.audience)}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sentDate ? `Enviada el ${sentDate}` : 'Sin fecha de envío'} · {c.recipient_count} destinatarios
                    {c.audience && c.audience !== 'subscribed' ? ` (${audienceLabel(c.audience)})` : ''} · {c.sent_count} enviados
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {deliveryRate ? `Entregabilidad ${deliveryRate}` : 'Sin entregas confirmadas'}
                    {openRate ? ` · Apertura ${openRate}` : ''}
                    {clickRate ? ` · Clics ${clickRate}` : ''}
                    {c.bounced_count > 0 ? ` · ${c.bounced_count} rebotaron` : ''}
                    {c.failed_count > 0 ? ` · ${c.failed_count} fallaron` : ''}
                    {c.complained_count > 0 ? ` · ${c.complained_count} marcaron como spam` : ''}
                  </p>
                </>
              )}
              {c.status === 'scheduled' && (
                <form action={cancelScheduledCampaign} className="mt-3">
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Cancelando…">
                    <X className="h-3.5 w-3.5" />
                    Cancelar envío
                  </SubmitButton>
                </form>
              )}
              {c.failed_count > 0 && c.status !== 'sending' && (
                <form action={retryFailedSends} className="mt-3">
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Reenviando…">
                    <RotateCw className="h-3.5 w-3.5" />
                    Reenviar a los {c.failed_count} que fallaron
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
