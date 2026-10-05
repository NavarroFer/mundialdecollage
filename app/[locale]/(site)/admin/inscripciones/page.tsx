import { createClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-muted text-muted-foreground' },
  paid: { label: 'Pagado', className: 'bg-collage-blue/15 text-collage-blue' },
  failed: { label: 'Fallido', className: 'bg-collage-red/15 text-collage-red' },
  cancelled: { label: 'Cancelado', className: 'bg-collage-red/15 text-collage-red' },
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  sena: 'Seña',
  completo: 'Completo',
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function InscripcionesPage() {
  const supabase = await createClient()
  const { data: registrations } = await supabase
    .from('workshop_registrations')
    .select('id, name, email, payment_type, status, amount_total, amount_paid, amount_pending, created_at')
    .order('created_at', { ascending: false })

  const list = registrations ?? []
  const paidCount = list.filter((r) => r.status === 'paid').length
  const pendingCount = list.filter((r) => r.status === 'pending').length

  return (
    <div>
      <AdminPageHeader eyebrow="Taller de collage" title="Inscripciones" description={adminDescription('/admin/inscripciones')} />

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Cupos pagados" value={`${paidCount} / ${site.workshop.capacity}`} />
        <StatPill label="Pendientes" value={pendingCount} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border-2 border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Pagado</th>
              <th className="px-4 py-3">Pendiente</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Todavía no hay inscripciones al taller.
                </td>
              </tr>
            )}
            {list.map((r) => {
              const meta = STATUS_META[r.status] ?? { label: r.status, className: 'bg-muted text-muted-foreground' }
              return (
                <tr key={r.id} className="border-t border-ink/10">
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{r.name ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {PAYMENT_TYPE_LABEL[r.payment_type] ?? r.payment_type}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{currencyFormatter.format(r.amount_total)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{currencyFormatter.format(r.amount_paid)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{currencyFormatter.format(r.amount_pending)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {dateFormatter.format(new Date(r.created_at))}
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
