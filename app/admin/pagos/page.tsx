import { createClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'

// One-time payments to postulate more than one obra (app/onboarding/obras).
// A checkout the artist opened and left without paying has no payment id and
// is left out — it's noise, not a payment.
const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'En proceso', className: 'bg-muted text-muted-foreground' },
  paid: { label: 'Pagado', className: 'bg-collage-blue/15 text-collage-blue' },
  failed: { label: 'Rechazado', className: 'bg-collage-red/15 text-collage-red' },
  refunded: { label: 'Devuelto', className: 'bg-collage-red/15 text-collage-red' },
}

const PROVIDER_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export default async function PagosPage() {
  const supabase = await createClient()
  const { data: purchases } = await supabase
    .from('entry_purchases')
    .select('id, user_id, email, provider, amount, currency, entries_allowed, status, mp_payment_id, created_at, paid_at')
    .or('mp_payment_id.not.is.null,status.neq.pending')
    .order('created_at', { ascending: false })

  const list = purchases ?? []
  const userIds = [...new Set(list.map((p) => p.user_id))]
  const [{ data: profiles }, { data: entered }] =
    userIds.length > 0
      ? await Promise.all([
          supabase.from('profiles').select('id, name').in('id', userIds),
          supabase
            .from('artworks')
            .select('profile_id')
            .in('profile_id', userIds)
            .eq('is_entered', true)
            .is('archived_at', null),
        ])
      : [{ data: [] as { id: string; name: string | null }[] }, { data: [] as { profile_id: string }[] }]

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const enteredByUser = new Map<string, number>()
  for (const row of entered ?? []) enteredByUser.set(row.profile_id, (enteredByUser.get(row.profile_id) ?? 0) + 1)

  const paid = list.filter((p) => p.status === 'paid')
  const totalArs = paid.filter((p) => p.currency === 'ARS').reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div>
      <AdminPageHeader eyebrow="Postulación de más obras" title="Pagos" description={adminDescription('/admin/pagos')} />

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Cada artista participa gratis con 1 obra. Con el pago único de{' '}
        {formatAmount(site.entries.priceArs, 'ARS')} / {formatAmount(site.entries.priceUsd, 'USD')} puede postular hasta{' '}
        {site.entries.paidLimit}.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Pagos acreditados" value={paid.length} />
        <StatPill label="Recaudado (ARS)" value={formatAmount(totalArs, 'ARS')} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border-2 border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Artista</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Medio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Obras postuladas</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Todavía no hay pagos.
                </td>
              </tr>
            )}
            {list.map((p) => {
              const meta = STATUS_META[p.status] ?? { label: p.status, className: 'bg-muted text-muted-foreground' }
              return (
                <tr key={p.id} className="border-t border-ink/10">
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{nameById.get(p.user_id) ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{p.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {PROVIDER_LABEL[p.provider] ?? p.provider}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{formatAmount(Number(p.amount), p.currency)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">
                    {enteredByUser.get(p.user_id) ?? 0} / {p.entries_allowed}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {dateFormatter.format(new Date(p.paid_at ?? p.created_at))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
