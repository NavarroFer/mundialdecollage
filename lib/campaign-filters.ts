// Filters and grouping for the list on /admin/campanas. Everything comes in
// through the URL (?estado=&audiencia=&origen=&q=) so a filtered view can be
// linked and survives the redirects the page's actions do.
import { CAMPAIGN_AUDIENCES } from '@/lib/campaign-audience'

export type CampaignListRow = {
  id: string
  subject: string
  status: string
  audience: string | null
  system_key: string | null
  scheduled_for: string | null
  sent_at: string | null
  created_at: string
  failed_count: number
}

export const STATUS_FILTERS = [
  { value: 'programadas', label: 'Programadas', matches: (c: CampaignListRow) => c.status === 'scheduled' },
  { value: 'enviadas', label: 'Enviadas', matches: (c: CampaignListRow) => c.status === 'sent' || c.status === 'sending' },
  {
    value: 'con-fallos',
    label: 'Con fallos',
    matches: (c: CampaignListRow) => c.status === 'failed' || c.failed_count > 0,
  },
  { value: 'borradores', label: 'Borradores', matches: (c: CampaignListRow) => c.status === 'draft' },
  { value: 'canceladas', label: 'Canceladas', matches: (c: CampaignListRow) => c.status === 'canceled' },
] as const

export const ORIGIN_FILTERS = [
  // The countdown the daily cron schedules on its own (lib/countdown-campaigns.ts).
  { value: 'automaticas', label: 'Automáticas', matches: (c: CampaignListRow) => Boolean(c.system_key) },
  { value: 'manuales', label: 'Manuales', matches: (c: CampaignListRow) => !c.system_key },
] as const

export type CampaignFilters = { estado?: string; audiencia?: string; origen?: string; q?: string }

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Unknown values are ignored rather than emptying the list.
export function filterCampaigns<T extends CampaignListRow>(list: T[], filters: CampaignFilters): T[] {
  const status = STATUS_FILTERS.find((f) => f.value === filters.estado)
  const origin = ORIGIN_FILTERS.find((f) => f.value === filters.origen)
  const audience = CAMPAIGN_AUDIENCES.find((a) => a.value === filters.audiencia)?.value
  const query = filters.q ? fold(filters.q) : ''
  return list.filter(
    (c) =>
      (!status || status.matches(c)) &&
      (!origin || origin.matches(c)) &&
      (!audience || (c.audience ?? 'subscribed') === audience) &&
      (!query || fold(c.subject).includes(query)),
  )
}

// The day a campaign belongs to on the timeline: when it went out, when it's
// due, or failing both when it was created.
export function campaignDate(c: CampaignListRow): Date {
  if (c.sent_at) return new Date(c.sent_at)
  if (c.scheduled_for) return new Date(`${c.scheduled_for}T12:00:00Z`)
  return new Date(c.created_at)
}

const monthFormat = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
})

// Scheduled sends first, soonest on top, then everything else by month,
// newest first.
export function groupCampaigns<T extends CampaignListRow>(list: T[]): Array<{ key: string; label: string; items: T[] }> {
  const upcoming = list
    .filter((c) => c.status === 'scheduled')
    .sort((a, b) => campaignDate(a).getTime() - campaignDate(b).getTime())
  const rest = list
    .filter((c) => c.status !== 'scheduled')
    .sort((a, b) => campaignDate(b).getTime() - campaignDate(a).getTime())

  const groups: Array<{ key: string; label: string; items: T[] }> = []
  if (upcoming.length > 0) groups.push({ key: 'upcoming', label: 'Próximos envíos', items: upcoming })
  for (const c of rest) {
    const label = monthFormat.format(campaignDate(c))
    const last = groups.at(-1)
    if (last && last.key === label) last.items.push(c)
    else groups.push({ key: label, label: label.charAt(0).toUpperCase() + label.slice(1), items: [c] })
  }
  return groups
}
