import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Income } from '@/lib/income'

vi.stubGlobal('React', React)
vi.mock('./actions', () => ({ recoverPayments: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { IncomeSection } from './income-section'

const since = new Date('2026-10-10T00:00:00Z')
const donation = (overrides: Partial<Income['donations'][number]>): Income['donations'][number] => ({
  id: 'd1',
  provider: 'mercadopago',
  status: 'paid',
  amount: 10000,
  currency: 'ARS',
  payer_email: 'ana@example.com',
  payer_name: null,
  created_at: '2026-10-16T15:00:00Z',
  paid_at: '2026-10-16T15:00:00Z',
  available_at: null,
  ...overrides,
})

const income = (donations: Income['donations']): Income => ({
  donations,
  paid: {
    donations: donations.filter((d) => d.status === 'paid').map((d) => ({ amount: d.amount, currency: d.currency, paidAt: d.paid_at })),
    entries: [{ amount: 5000, currency: 'ARS', paidAt: '2026-09-30T12:00:00Z' }],
    store: [],
    magazine: [],
  },
  activeSubscriptions: 1,
  loadedAt: new Date('2026-10-17T20:00:00Z').getTime(),
})

const text = (html: string) => html.replace(/\s/g, ' ')

describe('IncomeSection', () => {
  it('lists every donation and adds up the paid ones by currency', () => {
    const html = text(renderToStaticMarkup(<IncomeSection
      income={income([
        donation({}),
        donation({ id: 'd2', provider: 'paypal', amount: 10, currency: 'USD', payer_email: null }),
        donation({ id: 'd3', status: 'failed', amount: 5000, paid_at: null }),
      ])}
      since={since}
      period="últimos 30 días"
    />))
    expect(html).toContain('$ 10.000 + US$ 10 desde el inicio')
    expect(html).toContain('+2 · últimos 30 días')
    expect(html).toContain('ana@example.com')
    expect(html).toContain('PayPal')
    expect(html).toContain('Rechazada')
    expect(html).toContain('1 suscripción activa')
    expect(html).toContain('Buscar en Mercado Pago')
  })

  it('tells the donations whose money Mercado Pago still holds, and until when', () => {
    const html = text(renderToStaticMarkup(<IncomeSection
      income={income([
        donation({ available_at: '2026-10-30T15:00:00Z' }),
        donation({ id: 'd2', amount: 5000, available_at: '2026-10-16T15:00:00Z' }),
      ])}
      since={since}
      period="últimos 30 días"
    />))
    expect(html).toContain('$ 15.000 desde el inicio · $ 10.000 por acreditar')
    expect(html).toContain('Por acreditar')
    expect(html).toContain('se acredita el 30/10')
    expect(html).toContain('Acreditada')
  })

  it('says how to bring older donations when there are none yet', () => {
    const html = renderToStaticMarkup(<IncomeSection income={income([])} since={since} period="últimos 30 días" />)
    expect(html).toContain('Todavía no hay donaciones registradas')
  })

  it('says so when the payments could not load, instead of showing zeros', () => {
    const html = renderToStaticMarkup(<IncomeSection income={null} since={since} period="últimos 30 días" />)
    expect(html).toContain('No pudimos cargar los pagos')
    expect(html).not.toContain('Donaciones')
  })
})
