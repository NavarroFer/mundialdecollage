import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/page-header'

const STAGES: Record<string, string> = {
  create_subscription: 'Guardar la solicitud', create_preapproval: 'Iniciar la suscripción',
  save_preapproval: 'Guardar la respuesta del proveedor', checkout_url: 'Abrir el pago',
  sync_subscription: 'Actualizar la suscripción', recurring_payment: 'Cobro mensual', record_payment: 'Registrar el cobro',
}
const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
type Row = { id: string; provider: string; stage: string; http_status: number | null; message: string; codes: string[]; created_at: string; customers: { full_name: string; email: string } | null; subscriptions: { status: string; provider_plan_id: string } | null }

export default async function PaymentErrorsPage({ searchParams }: { searchParams: Promise<{ email?: string; page?: string }> }) {
  const params = await searchParams
  const email = (params.email ?? '').trim().toLowerCase().slice(0, 254)
  const page = Math.min(10000, Math.max(1, Math.trunc(Number(params.page)) || 1))
  const client = await createClient()
  // RLS allows only administrators to read diagnostics and linked customer data.
  let query = client.from('customer_payment_errors').select('id, provider, stage, http_status, message, codes, created_at, customers!inner(full_name, email), subscriptions(status, provider_plan_id)', { count: 'exact' })
  if (email) query = query.eq('customers.email', email)
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 50, page * 50 - 1)
  const rows = (data ?? []) as unknown as Row[]
  const url = (p: number) => `/admin/tienda/errores?${new URLSearchParams({ ...(email ? { email } : {}), page: String(p) })}`
  return (
    <div>
      <AdminPageHeader eyebrow="Tienda" title="Errores de pago por cliente" description="Cada intento fallido queda registrado, aunque después el cliente logre pagar. Los registros nuevos se conservan desde que se habilitó este historial." />
      <Link href="/admin/tienda" className="mt-4 inline-block text-sm underline">Volver a Club y envíos</Link>
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Email del cliente<input name="email" type="email" defaultValue={email} placeholder="cliente@ejemplo.com" className="mt-1 block rounded-md border border-input bg-background px-3 py-2" /></label>
        <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper">Buscar</button>
        {email && <Link href="/admin/tienda/errores" className="py-2 text-sm underline">Ver todos</Link>}
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-collage-red">No pudimos cargar el historial. Intentá de nuevo.</p>}
      <p className="mt-4 text-sm text-muted-foreground">{count ?? 0} errores registrados{email ? ' para este cliente' : ''}.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-ink/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs font-bold uppercase"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Proveedor / etapa</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Suscripción actual</th></tr></thead>
          <tbody>
            {!rows.length && !error && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No hay errores registrados{email ? ' para este cliente' : ''}.</td></tr>}
            {rows.map((row) => <tr key={row.id} className="border-t border-ink/10 align-top">
              <td className="px-4 py-3 whitespace-nowrap">{date.format(new Date(row.created_at))}</td>
              <td className="px-4 py-3"><p className="font-medium">{row.customers?.full_name ?? '—'}</p><Link href={`/admin/tienda/errores?email=${encodeURIComponent(row.customers?.email ?? '')}`} className="text-muted-foreground underline">{row.customers?.email}</Link></td>
              <td className="px-4 py-3"><p className="font-medium">{row.provider === 'paypal' ? 'PayPal' : 'Mercado Pago'}</p>{STAGES[row.stage] ?? row.stage}</td>
              <td className="max-w-lg px-4 py-3 break-words"><p>{row.message}</p>{(row.http_status || row.codes.length > 0) && <p className="mt-1 text-xs text-muted-foreground">{row.http_status ? `HTTP ${row.http_status} ` : ''}{row.codes.join(', ')}</p>}</td>
              <td className="px-4 py-3"><p>{row.subscriptions?.status ?? 'Sin suscripción creada'}</p><p className="text-xs text-muted-foreground">{row.subscriptions?.provider_plan_id}</p></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <nav aria-label="Páginas del historial" className="mt-4 flex gap-4 text-sm underline">{page > 1 && <Link href={url(page - 1)}>Anterior</Link>}{page * 50 < (count ?? 0) && <Link href={url(page + 1)}>Siguiente</Link>}</nav>
    </div>
  )
}
