import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import { formatAddress, formatMoney } from '@/lib/receipts'
import { planForProviderPlan } from '@/lib/subscription-receipts'
import { MESSAGES } from '@/lib/i18n/messages'
import { markShipmentSent, undoShipmentSent, updateShipmentProgress, retryShipmentNotice } from './actions'

// The store's day to day: who is subscribed, what has to go out in the mail
// and how much came in this month (subscriptions, the magazine and extra
// obras together). Subscriptions are charged by Mercado Pago (Argentina, ARS)
// or PayPal (abroad, USD); each charge creates one shipment.

const STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-collage-blue/15 text-collage-blue' },
  pending: { label: 'Sin completar', className: 'bg-muted text-muted-foreground' },
  past_due: { label: 'Pago atrasado', className: 'bg-collage-yellow/25 text-ink' },
  suspended: { label: 'Pausada', className: 'bg-collage-yellow/25 text-ink' },
  cancelled: { label: 'Cancelada', className: 'bg-collage-red/15 text-collage-red' },
  expired: { label: 'Vencida', className: 'bg-collage-red/15 text-collage-red' },
}

const PROVIDER: Record<string, string> = { mercadopago: 'Mercado Pago', paypal: 'PayPal' }

const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
const fmtDate = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : '—')

type Customer = { full_name: string; email: string }
type SubscriptionRow = {
  id: string
  provider: string
  provider_plan_id: string
  status: string
  shipping_address: Record<string, unknown>
  next_billing_at: string | null
  created_at: string
  customers: Customer | null
}
type ShipmentRow = {
  id: string
  status: string
  tracking_code: string | null
  pickup_deadline: string | null
  shipped_notice_sent_at: string | null
  pickup_notice_sent_at: string | null
  shipped_at: string | null
  created_at: string
  shipping_address: Record<string, unknown>
  payments: {
    amount: number
    currency: string
    paid_at: string
    provider: string
    subscriptions: { status: string; provider_plan_id: string; customers: Customer | null } | null
  } | null
}

function planName(providerPlanId: string) {
  const charge = planForProviderPlan(providerPlanId)
  return charge ? MESSAGES.es.store.plans[charge.plan.id].name : providerPlanId
}

function monthStart() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3)).toISOString() // 00:00 in Argentina
}

function sumByCurrency(rows: { amount: number | string; currency: string }[]) {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + Number(row.amount))
  return totals
}

export default async function TiendaAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; envios?: string }> }) {
  const { error, envios } = await searchParams
  const showSent = envios === 'enviados'
  const supabase = await createClient()
  const since = monthStart()

  const [subscriptionsResult, shipmentsResult, paymentsResult, magazineResult, entriesResult] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, provider, provider_plan_id, status, shipping_address, next_billing_at, created_at, customers(full_name, email)')
      .order('created_at', { ascending: false }),
    supabase.from('shipments')
      .select('id, status, tracking_code, shipped_at, pickup_deadline, shipped_notice_sent_at, pickup_notice_sent_at, created_at, shipping_address, payments!inner(amount, currency, paid_at, provider, subscriptions(status, provider_plan_id, customers(full_name, email)))')
      .in('status', showSent ? ['shipped', 'awaiting_pickup', 'delivered', 'returned'] : ['pending', 'packed'])
      .order('created_at', { ascending: !showSent })
      .limit(200),
    supabase.from('payments').select('amount, currency').eq('status', 'completed').gte('paid_at', since),
    supabase.from('magazine_orders').select('amount, currency').eq('status', 'paid').gte('paid_at', since),
    supabase.from('entry_purchases').select('amount, currency').eq('status', 'paid').gte('paid_at', since),
  ])
  const loadError = subscriptionsResult.error ?? shipmentsResult.error ?? paymentsResult.error
  const subscriptions = (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[]
  const shipments = (shipmentsResult.data ?? []) as unknown as ShipmentRow[]

  // A pending row is a checkout opened and never authorized: counted, not listed.
  const listed = subscriptions.filter((s) => s.status !== 'pending')
  const abandoned = subscriptions.length - listed.length
  const active = subscriptions.filter((s) => s.status === 'active')
  const recurring = new Map<string, number>()
  for (const s of active) {
    const charge = planForProviderPlan(s.provider_plan_id)
    if (charge) recurring.set(charge.currency, (recurring.get(charge.currency) ?? 0) + charge.amount)
  }
  const monthly = sumByCurrency([...(paymentsResult.data ?? []), ...(magazineResult.data ?? []), ...(entriesResult.data ?? [])])
  const money = (totals: Map<string, number>) =>
    totals.size ? [...totals].map(([currency, amount]) => formatMoney(amount, currency)).join(' + ') : formatMoney(0, 'ARS')

  return (
    <div>
      <AdminPageHeader eyebrow="Tienda" title="Club y envíos" description={adminDescription('/admin/tienda')} />
      <Link href="/admin/tienda/errores" className="mt-4 inline-block text-sm font-semibold text-collage-blue underline">Ver errores de pago por cliente</Link>
      {(error || loadError) && (
        <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ?? loadError?.message}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Suscripciones activas" value={active.length} />
        <StatPill label="Ingreso mensual recurrente" value={money(recurring)} />
        <StatPill label="Envíos por despachar" value={showSent ? '—' : shipments.length} />
        <StatPill label="Cobrado este mes (todo)" value={money(monthly)} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        «Cobrado este mes» suma suscripciones, <Link href="/admin/revista" className="underline">revista</Link> y{' '}
        <Link href="/admin/pagos" className="underline">obras extra</Link>, en su moneda.
      </p>

      <section className="mt-10" aria-labelledby="shipments-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="shipments-title" className="font-display text-2xl tracking-tight text-ink uppercase">
            {showSent ? 'Envíos despachados' : 'Para despachar'}
          </h2>
          <Link href={showSent ? '/admin/tienda' : '/admin/tienda?envios=enviados'} className="text-sm font-semibold text-collage-blue underline">
            {showSent ? 'Ver los pendientes' : 'Ver los ya despachados'}
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Cada cobro mensual acreditado genera un envío. Cancelar la suscripción detiene los próximos cobros; los envíos ya pagados se mantienen.</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Destino de retiro / envío</th>
                <th className="px-4 py-3">Cobro</th>
                <th className="px-4 py-3">{showSent ? 'Despachado' : 'Despacho'}</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{showSent ? 'Todavía no se despachó nada.' : 'No hay nada para despachar.'}</td></tr>
              )}
              {shipments.map((s) => {
                const customer = s.payments?.subscriptions?.customers
                const phone = typeof s.shipping_address?.phone === 'string' ? s.shipping_address.phone : null
                return (
                  <tr key={s.id} className="border-t border-ink/10 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{customer?.full_name ?? '—'}</p>
                      <p className="text-muted-foreground">{customer?.email}</p>
                      {phone && <p className="text-muted-foreground">{phone}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink">{s.payments?.subscriptions ? planName(s.payments.subscriptions.provider_plan_id) : '—'}</td>
                    <td className="min-w-64 px-4 py-3 text-ink">{formatAddress(s.shipping_address)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {s.payments ? `${formatMoney(Number(s.payments.amount), s.payments.currency)} · ${fmtDate(s.payments.paid_at)}` : '—'}
                      <p className="text-xs">{PROVIDER[s.payments?.provider ?? ''] ?? s.payments?.provider}</p>
                      {s.payments?.subscriptions?.status === 'cancelled' && <p className="mt-1 max-w-48 whitespace-normal text-xs text-collage-blue">Suscripción cancelada · este envío ya está pago</p>}
                    </td>
                    <td className="px-4 py-3">
                      {showSent ? (
                        <div className="space-y-3">
                          <p className="whitespace-nowrap text-ink">{fmtDate(s.shipped_at)}</p>
                          <p className="text-xs font-semibold">{({ shipped: 'En camino', awaiting_pickup: 'Disponible para retirar', delivered: 'Entregado / retirado', returned: 'Devuelto al remitente' } as Record<string, string>)[s.status]}</p>
                          {s.tracking_code && <p className="text-xs text-muted-foreground">Seguimiento: {s.tracking_code}</p>}
                          {s.pickup_deadline && <p className="text-xs">Retirar hasta: {s.pickup_deadline}</p>}
                          {s.shipping_address?.delivery_type === 'branch' && ['shipped', 'awaiting_pickup'].includes(s.status) && !(s.status === 'shipped' ? s.shipped_notice_sent_at : s.pickup_notice_sent_at) && <form action={retryShipmentNotice}>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton size="sm" variant="outline">Reintentar aviso por email</SubmitButton>
                          </form>}
                          {s.status === 'shipped' && s.shipping_address?.delivery_type === 'branch' && <form action={updateShipmentProgress} className="space-y-2">
                            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="awaiting_pickup" />
                            <label className="block text-xs">Fecha límite informada por Correo<input name="pickup_deadline" type="date" required className="mt-1 block rounded border px-2 py-1" /></label>
                            <p className="max-w-56 text-xs text-muted-foreground">Confirmá la llegada con el seguimiento antes de avisar al cliente.</p>
                            <SubmitButton size="sm">Disponible para retirar · avisar</SubmitButton>
                          </form>}
                          {['shipped', 'awaiting_pickup'].includes(s.status) && <form action={updateShipmentProgress} className="space-y-2">
                            <input type="hidden" name="id" value={s.id} />
                            <select name="status" aria-label="Estado del envío" className="block rounded border px-2 py-1 text-xs"><option value="delivered">Entregado / retirado</option><option value="returned">Devuelto al remitente</option></select>
                            <SubmitButton size="sm" variant="outline">Guardar estado</SubmitButton>
                          </form>}
                          {s.status === 'shipped' && <form action={undoShipmentSent}>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton size="sm" variant="outline">Deshacer despacho</SubmitButton>
                          </form>}
                        </div>
                      ) : (
                        <form action={markShipmentSent} className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input name="tracking_code" aria-label="Código de seguimiento" placeholder="Seguimiento (obligatorio para retiro)" required={s.shipping_address?.delivery_type === 'branch'} maxLength={120} className="w-56 rounded-md border border-ink/15 bg-background px-2 py-1.5 text-xs" />
                          <SubmitButton size="sm">Marcar enviado</SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="subscriptions-title">
        <h2 id="subscriptions-title" className="font-display text-2xl tracking-tight text-ink uppercase">Suscripciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {abandoned > 0
            ? `Además hay ${abandoned} ${abandoned === 1 ? 'checkout abierto' : 'checkouts abiertos'} sin completar, que no se listan.`
            : 'Todas las que llegaron a autorizar el cobro.'}
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Medio</th>
                <th className="px-4 py-3">Próximo cobro</th>
                <th className="px-4 py-3">Desde</th>
                <th className="px-4 py-3">Destino de retiro / envío</th>
              </tr>
            </thead>
            <tbody>
              {listed.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Todavía no hay suscripciones.</td></tr>
              )}
              {listed.map((s) => {
                const meta = STATUS[s.status] ?? { label: s.status, className: 'bg-muted text-muted-foreground' }
                return (
                  <tr key={s.id} className="border-t border-ink/10 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{s.customers?.full_name ?? '—'}</p>
                      <p className="text-muted-foreground">{s.customers?.email}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink">{planName(s.provider_plan_id)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{PROVIDER[s.provider] ?? s.provider}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.status === 'active' ? fmtDate(s.next_billing_at) : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(s.created_at)}</td>
                    <td className="min-w-64 px-4 py-3 text-ink">{formatAddress(s.shipping_address)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
