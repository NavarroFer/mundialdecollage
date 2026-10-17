import Link from 'next/link'
import { ChartError } from '@/components/admin/stats/chart-kit'
import { KpiCard, KpiStrip } from '@/components/admin/stats/kpi-card'
import { formatCount } from '@/lib/chart-math'
import { formatAmount, formatTotals, summarizeIncome, type DonationRow, type Income, type IncomeSummary } from '@/lib/income'
import { RecoverDonations } from './recover-donations'

// The «Pagos» tab of /admin/estadisticas: what came in by what it paid for,
// and every donation, since a donation has no admin page of its own.

const DONATION_STATUS: Record<DonationRow['status'], { label: string; className: string }> = {
  paid: { label: 'Acreditada', className: 'bg-collage-blue/15 text-collage-blue' },
  pending: { label: 'En proceso', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'Rechazada', className: 'bg-collage-red/15 text-collage-red' },
  refunded: { label: 'Devuelta', className: 'bg-collage-red/15 text-collage-red' },
}

const PROVIDER: Record<string, string> = { mercadopago: 'Mercado Pago', paypal: 'PayPal' }

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

const plural = (count: number, one: string, other: string) => `${formatCount(count)} ${count === 1 ? one : other}`

export function IncomeSection({ income, since, period }: {
  income: Income | null
  /** Where the period starts, for the «+N» chips. */
  since: Date
  /** «últimos 30 días» */
  period: string
}) {
  if (!income) return <ChartError>No pudimos cargar los pagos. Recargá la página para reintentar.</ChartError>
  const donations = summarizeIncome(income.paid.donations, since)
  const entries = summarizeIncome(income.paid.entries, since)
  const store = summarizeIncome(income.paid.store, since)
  const magazine = summarizeIncome(income.paid.magazine, since)
  const recent = (summary: IncomeSummary) => `+${formatCount(summary.recentCount)} · ${period}`

  return (
    <>
      <KpiStrip label="Pagos en números">
        <KpiCard highlight label="Donaciones" value={formatCount(donations.count)} context={`${formatTotals(donations.totals)} desde el inicio`} recent={recent(donations)} />
        <KpiCard label="Obras extra" value={formatCount(entries.count)} context={`${formatTotals(entries.totals)} desde el inicio`} recent={recent(entries)} />
        <KpiCard
          label="Cobros de la tienda"
          value={formatCount(store.count)}
          context={`${formatTotals(store.totals)} · ${plural(income.activeSubscriptions, 'suscripción activa', 'suscripciones activas')}`}
          recent={recent(store)}
        />
        <KpiCard label="Revista" value={formatCount(magazine.count)} context={`${formatTotals(magazine.totals)} en la preventa`} recent={recent(magazine)} />
      </KpiStrip>
      <p className="mt-3 text-xs text-muted-foreground">
        Cada pago acreditado cuenta una vez; el chip, los del período. El detalle de cada uno está en{' '}
        <Link href="/admin/pagos" className="underline">Pagos de obras extra</Link>,{' '}
        <Link href="/admin/tienda" className="underline">Club y envíos</Link> y{' '}
        <Link href="/admin/revista" className="underline">Revista</Link>.
      </p>

      <section aria-labelledby="donations-title" className="mt-6 overflow-hidden rounded-3xl border-2 border-ink/10 bg-card">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 sm:p-6">
          <div className="min-w-0 flex-1 basis-64">
            <h2 id="donations-title" className="font-display text-2xl font-normal tracking-tight text-ink uppercase">Donaciones</h2>
            <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
              Cada donación, la más reciente primero. Las que no se acreditaron (una tarjeta rechazada, un pago en efectivo todavía sin hacer) quedan con su estado.
            </p>
          </div>
          <RecoverDonations />
        </header>
        <div className="overflow-x-auto border-t-2 border-ink/10">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 sm:px-6">Fecha</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Medio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Quién donó</th>
              </tr>
            </thead>
            <tbody>
              {income.donations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground sm:px-6">
                    Todavía no hay donaciones registradas. Si alguien donó en pesos antes de que se anotaran solas, tocá «Buscar en Mercado Pago».
                  </td>
                </tr>
              )}
              {income.donations.map((donation) => {
                const status = DONATION_STATUS[donation.status] ?? { label: donation.status, className: 'bg-muted text-muted-foreground' }
                return (
                  <tr key={donation.id} className="border-t border-ink/10">
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground sm:px-6">{dateFormatter.format(new Date(donation.paid_at ?? donation.created_at))}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-ink tabular-nums">{formatAmount(Number(donation.amount), donation.currency)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{PROVIDER[donation.provider] ?? donation.provider}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {donation.payer_name && <p className="text-ink">{donation.payer_name}</p>}
                      <p className="text-muted-foreground">{donation.payer_email ?? (donation.payer_name ? null : '—')}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t-2 border-ink/10 px-5 py-4 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Cada donación se anota sola cuando Mercado Pago o PayPal avisan el pago. PayPal no dice quién donó: está en su panel. «Buscar en Mercado Pago» trae las donaciones en pesos cuyo aviso no llegó; repetirlo no duplica nada.
        </p>
      </section>
    </>
  )
}
