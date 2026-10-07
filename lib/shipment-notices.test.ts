import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ db: vi.fn(), mail: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.db }))
vi.mock('@/lib/mail', () => ({ isMailConfigured: true, sendMail: mocks.mail }))
import { sendShipmentNotice } from './shipment-notices'

interface Builder {
  eq: (key: string, value: unknown) => Builder
  is: (key: string, value: unknown) => Builder
  select: () => Builder
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>
  then: (resolve: (value: { error: null }) => unknown) => Promise<unknown>
}
function database(row: Record<string, unknown>) {
  return { from: () => ({ update: (change: Record<string, unknown>) => {
    const filters: [string, unknown][] = []
    const matches = () => filters.every(([key, value]) => row[key] === value)
    const builder: Builder = {
      eq(key, value) { filters.push([key, value]); return builder },
      is(key, value) { filters.push([key, value]); return builder },
      select() { return builder },
      async maybeSingle() { if (!matches()) return { data: null, error: null }; Object.assign(row, change); return { data: row, error: null } },
      then(resolve) { if (matches()) Object.assign(row, change); return Promise.resolve(resolve({ error: null })) },
    }
    return builder
  } }) }
}
function fixture() {
  return {
    id: 'shipment', status: 'shipped', shipped_notice_sent_at: null, pickup_notice_sent_at: null,
    tracking_code: 'CP123456AR', pickup_deadline: '2026-10-20',
    shipping_address: { country_code: 'AR', delivery_type: 'branch', branch_code: 'B0107', branch_name: 'Monte Grande', recipient_name: 'Ana', address_line_1: 'Vicente López 448' },
    payments: { subscriptions: { customers: { email: 'buyer@example.com', full_name: 'Ana' } } },
  }
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test'); mocks.mail.mockResolvedValue({ ok: true }) })

it('sends dispatch only once, with a tracking link and without claiming arrival', async () => {
  const row = fixture(); mocks.db.mockReturnValue(database(row))
  expect(await sendShipmentNotice('shipment', 'shipped')).toBe(true)
  expect(await sendShipmentNotice('shipment', 'shipped')).toBe(true)
  expect(mocks.mail).toHaveBeenCalledTimes(1)
  const mail = mocks.mail.mock.calls[0][0]
  expect(mail.text).toContain('CP123456AR')
  expect(mail.text).toContain('esperá la confirmación de llegada')
  expect(mail.subject).not.toContain('disponible para retirar')
})

it('does not send pickup-ready before an admin confirms the arrival status', async () => {
  mocks.db.mockReturnValue(database(fixture()))
  await sendShipmentNotice('shipment', 'awaiting_pickup')
  expect(mocks.mail).not.toHaveBeenCalled()
})

it('releases a failed notice so the admin can retry it without changing shipment status', async () => {
  const row = fixture(); mocks.db.mockReturnValue(database(row)); mocks.mail.mockResolvedValueOnce({ ok: false, error: 'Temporary failure' })
  expect(await sendShipmentNotice('shipment', 'shipped')).toBe(false)
  expect(row.shipped_notice_sent_at).toBeNull()
  expect(row.status).toBe('shipped')
  expect(await sendShipmentNotice('shipment', 'shipped')).toBe(true)
  expect(mocks.mail).toHaveBeenCalledTimes(2)
})

it('includes the actual branch, recipient and deadline in the arrival notice', async () => {
  const row = { ...fixture(), status: 'awaiting_pickup' }; mocks.db.mockReturnValue(database(row))
  expect(await sendShipmentNotice('shipment', 'awaiting_pickup')).toBe(true)
  const mail = mocks.mail.mock.calls[0][0]
  expect(mail.subject).toContain('disponible para retirar')
  expect(mail.text).toContain('Monte Grande (B0107)')
  expect(mail.text).toContain('20 de octubre de 2026')
  expect(mail.text).toContain('acreditar su identidad')
})
