import { describe, expect, it } from 'vitest'
import { filterCampaigns, groupCampaigns, type CampaignListRow } from './campaign-filters'

const row = (overrides: Partial<CampaignListRow>): CampaignListRow => ({
  id: overrides.subject ?? 'x',
  subject: 'Asunto',
  status: 'sent',
  audience: 'subscribed',
  system_key: null,
  scheduled_for: null,
  sent_at: null,
  created_at: '2026-09-01T12:00:00Z',
  failed_count: 0,
  ...overrides,
})

const list = [
  row({ subject: 'Últimos días para participar', status: 'scheduled', scheduled_for: '2026-10-10', system_key: 'cuenta_regresiva_7', audience: 'not_participating' }),
  row({ subject: 'Faltan 15 días', status: 'scheduled', scheduled_for: '2026-10-05', system_key: 'cuenta_regresiva_15', audience: 'not_participating' }),
  row({ subject: 'Novedades de septiembre', sent_at: '2026-09-20T15:00:00Z', failed_count: 2 }),
  row({ subject: 'Confirmá tus datos', sent_at: '2026-10-01T15:00:00Z', audience: 'profile_review' }),
  row({ subject: 'Borrador viejo', status: 'draft', created_at: '2026-08-10T12:00:00Z' }),
]

describe('filterCampaigns', () => {
  it('returns everything with no filters, and ignores unknown values', () => {
    expect(filterCampaigns(list, {})).toHaveLength(5)
    expect(filterCampaigns(list, { estado: 'nope', audiencia: 'nope', origen: 'nope' })).toHaveLength(5)
  })

  it('filters by status, origin, audience and an accent-insensitive search', () => {
    expect(filterCampaigns(list, { estado: 'programadas' }).map((c) => c.subject)).toHaveLength(2)
    expect(filterCampaigns(list, { estado: 'con-fallos' }).map((c) => c.subject)).toEqual(['Novedades de septiembre'])
    expect(filterCampaigns(list, { origen: 'manuales' })).toHaveLength(3)
    expect(filterCampaigns(list, { audiencia: 'profile_review' }).map((c) => c.subject)).toEqual(['Confirmá tus datos'])
    expect(filterCampaigns(list, { q: 'ultimos DIAS' }).map((c) => c.subject)).toEqual(['Últimos días para participar'])
  })
})

describe('groupCampaigns', () => {
  it('puts scheduled sends first, soonest on top, then months newest first', () => {
    const groups = groupCampaigns(list)
    expect(groups.map((g) => g.label)).toEqual(['Próximos envíos', 'Octubre de 2026', 'Septiembre de 2026', 'Agosto de 2026'])
    expect(groups[0].items.map((c) => c.scheduled_for)).toEqual(['2026-10-05', '2026-10-10'])
  })
})
