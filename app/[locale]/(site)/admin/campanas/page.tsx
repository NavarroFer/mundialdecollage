import Link from 'next/link'
import { campaignEngagementTotals } from '@/lib/campaign-metrics'
import {
  Bot,
  CalendarClock,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  FileText,
  Loader2,
  Plus,
  RotateCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { cancelScheduledCampaign, retryFailedSends } from './actions'
import { formatScheduleDay, SCHEDULED_SEND_TIME_LABEL } from '@/lib/campaign-schedule'
import { audienceLabel, CAMPAIGN_AUDIENCES, type CampaignAudience } from '@/lib/campaign-audience'
import {
  campaignDate,
  filterCampaigns,
  groupCampaigns,
  ORIGIN_FILTERS,
  STATUS_FILTERS,
  type CampaignFilters,
} from '@/lib/campaign-filters'
import { adminDescription } from '@/components/admin/admin-sections'

type StatusStyle = {
  label: string
  icon: typeof Circle
  className: string
  // The card's left edge and its date tile.
  stripe: string
  tile: string
  spin?: boolean
}

const STATUS: Record<string, StatusStyle> = {
  draft: {
    label: 'Borrador',
    icon: Circle,
    className: 'bg-ink/10 text-muted-foreground',
    stripe: 'border-l-ink/20',
    tile: 'bg-ink/5 text-muted-foreground',
  },
  scheduled: {
    label: 'Programada',
    icon: CalendarClock,
    className: 'bg-collage-yellow/15 text-collage-yellow',
    stripe: 'border-l-collage-yellow',
    tile: 'bg-collage-yellow text-white',
  },
  canceled: {
    label: 'Cancelada',
    icon: CircleSlash,
    className: 'bg-ink/10 text-muted-foreground',
    stripe: 'border-l-ink/20',
    tile: 'bg-ink/5 text-muted-foreground line-through',
  },
  sending: {
    label: 'Enviando…',
    icon: Loader2,
    className: 'bg-collage-yellow/15 text-collage-yellow',
    stripe: 'border-l-collage-yellow',
    tile: 'bg-collage-yellow/15 text-collage-yellow',
    spin: true,
  },
  sent: {
    label: 'Enviada',
    icon: CircleCheck,
    className: 'bg-collage-blue/15 text-collage-blue',
    stripe: 'border-l-collage-blue',
    tile: 'bg-collage-blue text-white',
  },
  failed: {
    label: 'Falló',
    icon: CircleAlert,
    className: 'bg-collage-red/15 text-collage-red',
    stripe: 'border-l-collage-red',
    tile: 'bg-collage-red text-white',
  },
}

const FALLBACK_STATUS: StatusStyle = STATUS.draft

const STATUS_FILTER_DOT: Record<string, string> = {
  programadas: 'bg-collage-yellow',
  enviadas: 'bg-collage-blue',
  'con-fallos': 'bg-collage-red',
  borradores: 'bg-ink/30',
  canceladas: 'bg-ink/30',
}

const AUDIENCE_STYLE: Record<CampaignAudience, { dot: string; tag: string }> = {
  subscribed: { dot: 'bg-collage-blue', tag: 'border-collage-blue/30 bg-collage-blue/5 text-collage-blue' },
  no_artwork: { dot: 'bg-collage-yellow', tag: 'border-collage-yellow/40 bg-collage-yellow/5 text-collage-yellow' },
  not_participating: { dot: 'bg-collage-red', tag: 'border-collage-red/30 bg-collage-red/5 text-collage-red' },
  multiple_artworks: { dot: 'bg-collage-blue', tag: 'border-collage-blue/30 bg-collage-blue/5 text-collage-blue' },
  profile_review: { dot: 'bg-ink', tag: 'border-ink/20 bg-ink/5 text-ink' },
}

type CampaignRow = {
  id: string
  subject: string
  status: string
  audience: string | null
  system_key: string | null
  scheduled_for: string | null
  recipient_count: number
  sent_count: number
  failed_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  complained_count: number
  sent_at: string | null
  created_at: string
  template: { name: string } | null
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

function formatShortDay(day: string | null) {
  if (!day) return ''
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function rate(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : null
}

function filterHref(filters: CampaignFilters, key: keyof CampaignFilters, value?: string) {
  const params = new URLSearchParams()
  const next = { ...filters, [key]: value }
  for (const k of ['estado', 'audiencia', 'origen', 'q'] as const) {
    if (next[k]) params.set(k, next[k])
  }
  const query = params.toString()
  return query ? `/admin/campanas?${query}` : '/admin/campanas'
}

function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string | number
  detail: string
  tone: 'blue' | 'yellow' | 'red' | 'ink'
}) {
  const accent = {
    blue: 'bg-collage-blue',
    yellow: 'bg-collage-yellow',
    red: 'bg-collage-red',
    ink: 'bg-ink',
  }[tone]
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-ink/10 bg-card px-5 py-4">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />
      <p className="font-display text-3xl text-ink tabular-nums">{value}</p>
      <p className="text-xs font-semibold tracking-wide text-ink uppercase">{label}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-24 shrink-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterChip({
  href,
  active,
  count,
  dotClassName,
  children,
}: {
  href: string
  active: boolean
  count?: number
  dotClassName?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-ink/10 bg-background text-ink hover:border-ink/30'
      } ${count === 0 && !active ? 'opacity-50' : ''}`}
    >
      {dotClassName && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dotClassName}`} />}
      {children}
      {count !== undefined && (
        <span className={`tabular-nums ${active ? 'text-white/70' : 'text-muted-foreground'}`}>{count}</span>
      )}
    </Link>
  )
}

function MetricBar({
  label,
  value,
  total,
  barClassName,
}: {
  label: string
  value: number
  total: number
  barClassName: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-ink">{total > 0 ? `${pct}%` : '—'}</span> · {value}
        </span>
      </div>
      <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CampaignCard({ campaign: c }: { campaign: CampaignRow }) {
  const status = STATUS[c.status] ?? { ...FALLBACK_STATUS, label: c.status }
  const StatusIcon = status.icon
  const audience = (c.audience ?? 'subscribed') as CampaignAudience
  const audienceStyle = AUDIENCE_STYLE[audience] ?? AUDIENCE_STYLE.subscribed
  const date = campaignDate(c)
  const dayFormat = { timeZone: 'America/Argentina/Buenos_Aires' } as const
  const day = date.toLocaleDateString('es-AR', { ...dayFormat, day: 'numeric' })
  const month = date.toLocaleDateString('es-AR', { ...dayFormat, month: 'short' }).replace('.', '')
  const sentDate = formatCampaignDate(c.sent_at)
  const base = c.delivered_count || c.sent_count
  const wentOut = c.status === 'sent' || c.status === 'sending' || c.status === 'failed'

  return (
    <article className={`rounded-2xl border-2 border-l-[6px] border-ink/10 bg-card px-4 py-4 sm:px-5 ${status.stripe}`}>
      <div className="flex gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${status.tile}`}
          title={date.toLocaleDateString('es-AR', { ...dayFormat, dateStyle: 'full' })}
        >
          <span className="font-display text-2xl">{day}</span>
          <span className="mt-0.5 text-[10px] font-bold tracking-wider uppercase">{month}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 font-semibold break-words text-ink">{c.subject}</p>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${status.className}`}
            >
              <StatusIcon className={`h-3.5 w-3.5 ${status.spin ? 'animate-spin' : ''}`} />
              {status.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${audienceStyle.tag}`}>
              <Users className="h-3 w-3" />
              {audienceLabel(c.audience)}
            </span>
            {c.system_key ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-ink/5 px-2.5 py-0.5 text-xs font-semibold text-ink">
                <Bot className="h-3 w-3" />
                Automática
              </span>
            ) : (
              c.template?.name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {c.template.name}
                </span>
              )
            )}
            {c.bounced_count > 0 && <IssueTag>{c.bounced_count} rebotaron</IssueTag>}
            {c.failed_count > 0 && <IssueTag>{c.failed_count} fallaron</IssueTag>}
            {c.complained_count > 0 && <IssueTag>{c.complained_count} spam</IssueTag>}
          </div>

          {c.status === 'scheduled' || c.status === 'canceled' ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {c.status === 'scheduled' ? 'Sale el' : 'Iba a salir el'} {formatScheduleDay(c.scheduled_for ?? '')}
              {c.status === 'scheduled' ? ` a las ${SCHEDULED_SEND_TIME_LABEL}` : ''}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {sentDate ? `Enviada el ${sentDate}` : 'Sin fecha de envío'} · {c.recipient_count} destinatarios ·{' '}
              {c.sent_count} enviados
            </p>
          )}

          {wentOut && c.sent_count > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MetricBar label="Entregados" value={c.delivered_count} total={c.sent_count} barClassName="bg-collage-blue" />
              <MetricBar label="Abiertos" value={c.opened_count} total={base} barClassName="bg-collage-yellow" />
              <MetricBar label="Clics" value={c.clicked_count} total={base} barClassName="bg-collage-red" />
            </div>
          )}

          {(c.status === 'scheduled' || (c.failed_count > 0 && c.status !== 'sending')) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status === 'scheduled' && (
                <form action={cancelScheduledCampaign}>
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Cancelando…">
                    <X className="h-3.5 w-3.5" />
                    Cancelar envío
                  </SubmitButton>
                </form>
              )}
              {c.failed_count > 0 && c.status !== 'sending' && (
                <form action={retryFailedSends}>
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Reenviando…">
                    <RotateCw className="h-3.5 w-3.5" />
                    Reenviar a los {c.failed_count} que fallaron
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function IssueTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-collage-red/10 px-2.5 py-0.5 text-xs font-semibold text-collage-red">
      <CircleAlert className="h-3 w-3" />
      {children}
    </span>
  )
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
    estado?: string
    audiencia?: string
    origen?: string
    q?: string
  }>
}) {
  const { sent, retried, skipped, failed, scheduled, canceled, error, ...rawFilters } = await searchParams
  const filters: CampaignFilters = {
    estado: rawFilters.estado,
    audiencia: rawFilters.audiencia,
    origen: rawFilters.origen,
    q: rawFilters.q?.trim() || undefined,
  }
  const supabase = await createClient()
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      'id, subject, status, audience, system_key, scheduled_for, recipient_count, sent_count, failed_count, delivered_count, opened_count, clicked_count, bounced_count, complained_count, sent_at, created_at, template:templates(name)',
    )
    .order('created_at', { ascending: false })

  const list = (campaigns ?? []) as unknown as CampaignRow[]
  const filtered = filterCampaigns(list, filters)
  const groups = groupCampaigns(filtered)
  const hasFilters = Object.values(filters).some(Boolean)

  // The summary is always over every campaign, whatever is filtered below.
  const sentList = list.filter((c) => c.status === 'sent')
  const scheduledList = list
    .filter((c) => c.status === 'scheduled')
    .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))
  const nextScheduled = scheduledList[0]
  const totalSent = list.reduce((sum, c) => sum + c.sent_count, 0)
  const { delivered: totalDelivered, opened: totalOpened, clicked: totalClicked, campaigns: trackedCount } = campaignEngagementTotals(list)

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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Enviadas" value={sentList.length} detail={`${totalSent.toLocaleString('es-AR')} emails`} tone="blue" />
        <SummaryTile
          label="Programadas"
          value={scheduledList.length}
          detail={nextScheduled ? `Próxima: ${formatShortDay(nextScheduled.scheduled_for)}` : 'Ninguna en cola'}
          tone="yellow"
        />
        <SummaryTile label="Apertura promedio" value={rate(totalOpened, totalDelivered) ?? '—'} detail={`sobre entregados · ${trackedCount} campañas con tracking`} tone="ink" />
        <SummaryTile label="Clics promedio" value={rate(totalClicked, totalDelivered) ?? '—'} detail={`sobre entregados · ${trackedCount} campañas con tracking`} tone="red" />
      </div>

      <div className="mt-8 space-y-3 rounded-2xl border-2 border-ink/10 bg-card p-4">
        <form action="/admin/campanas" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Buscar por asunto…"
            className="h-10 w-full rounded-xl border-2 border-ink/10 bg-background pr-3 pl-9 text-sm text-ink placeholder:text-muted-foreground focus-visible:border-collage-blue focus-visible:outline-none"
          />
          {filters.estado && <input type="hidden" name="estado" value={filters.estado} />}
          {filters.audiencia && <input type="hidden" name="audiencia" value={filters.audiencia} />}
          {filters.origen && <input type="hidden" name="origen" value={filters.origen} />}
        </form>

        <FilterRow label="Estado">
          <FilterChip href={filterHref(filters, 'estado')} active={!filters.estado} count={list.length}>
            Todas
          </FilterChip>
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              href={filterHref(filters, 'estado', f.value)}
              active={filters.estado === f.value}
              count={list.filter(f.matches).length}
              dotClassName={STATUS_FILTER_DOT[f.value]}
            >
              {f.label}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Audiencia">
          <FilterChip href={filterHref(filters, 'audiencia')} active={!filters.audiencia}>
            Todas
          </FilterChip>
          {CAMPAIGN_AUDIENCES.map((a) => (
            <FilterChip
              key={a.value}
              href={filterHref(filters, 'audiencia', a.value)}
              active={filters.audiencia === a.value}
              count={list.filter((c) => (c.audience ?? 'subscribed') === a.value).length}
              dotClassName={AUDIENCE_STYLE[a.value].dot}
            >
              {a.label}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Origen">
          <FilterChip href={filterHref(filters, 'origen')} active={!filters.origen}>
            Todas
          </FilterChip>
          {ORIGIN_FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              href={filterHref(filters, 'origen', f.value)}
              active={filters.origen === f.value}
              count={list.filter(f.matches).length}
            >
              {f.label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {hasFilters && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {filtered.length === 1 ? '1 campaña' : `${filtered.length} campañas`} de {list.length}
          <Link href="/admin/campanas" className="font-semibold text-collage-blue underline-offset-4 hover:underline">
            Limpiar filtros
          </Link>
        </p>
      )}

      <div className="mt-8 space-y-10">
        {list.length === 0 && <p className="text-muted-foreground">Todavía no mandaste ninguna campaña.</p>}
        {list.length > 0 && filtered.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-ink/15 px-5 py-10 text-center text-muted-foreground">
            Ninguna campaña coincide con estos filtros.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="mb-3 flex items-center gap-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {group.key === 'upcoming' && <CalendarClock className="h-4 w-4 text-collage-yellow" />}
              {group.label}
              <span className="h-px flex-1 bg-ink/10" />
              <span className="tabular-nums">{group.items.length}</span>
            </h2>
            <div className="space-y-3">
              {group.items.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
