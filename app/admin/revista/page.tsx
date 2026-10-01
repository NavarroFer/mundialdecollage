import { createClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import type { MagazineShipping } from '@/lib/magazine'
import { countryCodeToName } from '@/lib/participants'
import { setMagazineShipped } from './actions'

// Preventa de la Revista 1ª Edición (app/revista): who paid, where to send
// it, and what's already on its way. A checkout opened and left without
// paying has no payment id and is left out — noise, not an order.
const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'En proceso', className: 'bg-muted text-muted-foreground' },
  paid: { label: 'Pagado', className: 'bg-collage-blue/15 text-collage-blue' },
  failed: { label: 'Rechazado', className: 'bg-collage-red/15 text-collage-red' },
  refunded: { label: 'Devuelto', className: 'bg-collage-red/15 text-collage-red' },
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

function formatArs(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

function formatAddress(address: MagazineShipping) {
  const street = [address.address_line_1, address.address_line_2].filter(Boolean).join(', ')
  // Orders from before shipping abroad have no country: Argentina.
  return `${street} — ${address.city}, ${address.province} (${address.postal_code}), ${countryCodeToName(address.country_code ?? 'AR')}`
}

export default async function RevistaAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: orders, error: loadError } = await supabase
    .from('magazine_orders')
    .select('id, name, email, phone, shipping_address, quantity, amount, status, mp_payment_id, created_at, paid_at, shipped_at')
    .or('mp_payment_id.not.is.null,status.neq.pending')
    .order('created_at', { ascending: false })

  const list = orders ?? []
  const paid = list.filter((o) => o.status === 'paid')
  const copies = paid.reduce((sum, o) => sum + o.quantity, 0)
  const totalArs = paid.reduce((sum, o) => sum + Number(o.amount), 0)
  const toShip = paid.filter((o) => !o.shipped_at).reduce((sum, o) => sum + o.quantity, 0)

  return (
    <div>
      <AdminPageHeader eyebrow="Tienda" title="Revista" description={adminDescription('/admin/revista')} />

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        {site.magazine.priceArs === null
          ? 'La preventa todavía no tiene precio: /revista junta mails («Avisame», en Contactos con origen aviso_revista). Cargá el precio en lib/site.ts (site.magazine.priceArs) para abrirla.'
          : `Preventa abierta a ${formatArs(site.magazine.priceArs)} por ejemplar con envío en Argentina${site.magazine.shippingAbroadArs === null ? '; fuera de Argentina todavía no se vende (cargá site.magazine.shippingAbroadArs).' : `, más ${formatArs(site.magazine.shippingAbroadArs)} por pedido al exterior.`}`}
      </p>
      {(error || loadError) && (
        <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ?? loadError?.message}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Ejemplares vendidos" value={copies} />
        <StatPill label="Por despachar" value={toShip} />
        <StatPill label="Recaudado (ARS)" value={formatArs(totalArs)} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border-2 border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Comprador</th>
              <th className="px-4 py-3">Envío</th>
              <th className="px-4 py-3">Ejemplares</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Despacho</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Todavía no hay pedidos.
                </td>
              </tr>
            )}
            {list.map((o) => {
              const meta = STATUS_META[o.status] ?? { label: o.status, className: 'bg-muted text-muted-foreground' }
              return (
                <tr key={o.id} className="border-t border-ink/10 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{o.name}</p>
                    <p className="text-muted-foreground">{o.email}</p>
                    <p className="text-muted-foreground">{o.phone}</p>
                  </td>
                  <td className="min-w-64 px-4 py-3 text-ink">{formatAddress(o.shipping_address as MagazineShipping)}</td>
                  <td className="px-4 py-3 text-ink">{o.quantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{formatArs(Number(o.amount))}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{dateFormatter.format(new Date(o.paid_at ?? o.created_at))}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {o.status === 'paid' && (
                      <form action={setMagazineShipped}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="shipped" value={o.shipped_at ? '0' : '1'} />
                        {o.shipped_at && <p className="mb-1 text-xs text-muted-foreground">Enviado el {dateFormatter.format(new Date(o.shipped_at))}</p>}
                        <SubmitButton size="sm" variant={o.shipped_at ? 'outline' : 'default'}>
                          {o.shipped_at ? 'Deshacer' : 'Marcar enviado'}
                        </SubmitButton>
                      </form>
                    )}
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
