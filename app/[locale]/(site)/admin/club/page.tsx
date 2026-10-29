import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import { MAX_COURTESY_COINS } from '@/lib/club-courtesy'
import { grantCourtesy, endCourtesy } from './actions'

// The Club's galleries, paid or complimentary, and the form that gives a
// founder their gallery without a subscription (lib/club-courtesy.ts).

type GalleryRow = {
  id: string
  slug: string
  title: string
  status: string
  email: string | null
  courtesy_granted_at: string | null
  subscription_status: string | null
  balance: number
  hung: number
  created_at: string
}

const STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-collage-blue/15 text-collage-blue' },
  draft: { label: 'Esperando el primer cobro', className: 'bg-muted text-muted-foreground' },
  paused: { label: 'Pausada', className: 'bg-collage-yellow/25 text-ink' },
}

const SUBSCRIPTION: Record<string, string> = {
  active: 'Suscripción al día',
  pending: 'Suscripción sin completar',
  past_due: 'Pago atrasado',
  suspended: 'Suscripción pausada',
  cancelled: 'Suscripción cancelada',
  expired: 'Suscripción vencida',
}

const ERRORS: Record<string, string> = {
  invalid: 'Revisá el email y las monedas (un número entero, de 0 a 100.000).',
  no_account: 'Ese email todavía no tiene cuenta: pedile que entre una vez al sitio con Google y probá de nuevo.',
  no_name: 'Esa cuenta no tiene nombre en su perfil: escribí el nombre de la galería.',
  paying: 'Esa persona ya paga su suscripción y su galería está activa: no se cambió nada.',
  unavailable: 'No se pudo guardar. Probá de nuevo en un rato.',
}

const DONE: Record<string, string> = {
  created: 'Listo: la galería quedó activa como cortesía.',
  reactivated: 'Listo: su galería volvió a estar activa como cortesía, con lo que ya tenía armado.',
  already_courtesy: 'Ya tenía la galería de cortesía: se le sumaron las monedas.',
  ended: 'Listo: terminó la cortesía.',
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
const fmtDate = (value: string) => dateFormatter.format(new Date(value))

export default async function ClubAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; listo?: string }> }) {
  const { error, listo } = await searchParams
  const supabase = await createClient()
  const { data, error: loadError } = await supabase.rpc('admin_club_galleries')
  const galleries = (data ?? []) as GalleryRow[]
  const active = galleries.filter((g) => g.status === 'active')
  const courtesies = active.filter((g) => g.courtesy_granted_at)

  return (
    <div>
      <AdminPageHeader eyebrow="Galería 3D" title="Galerías del Club" description={adminDescription('/admin/club')} />
      {(error || loadError) && (
        <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ? ERRORS[error] ?? ERRORS.unavailable : loadError?.message}</p>
      )}
      {listo && DONE[listo] && <p role="status" className="mt-4 rounded-lg bg-collage-blue/10 p-3 text-sm text-ink">{DONE[listo]}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Galerías activas" value={active.length} />
        <StatPill label="De cortesía" value={courtesies.length} />
        <StatPill label="Pagas" value={active.length - courtesies.length} />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.6fr]" aria-labelledby="courtesy-title">
        <div className="self-start rounded-2xl border-2 border-ink/10 bg-card p-5">
          <h2 id="courtesy-title" className="font-display text-xl tracking-tight text-ink uppercase">Dar una galería de cortesía</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Para los fundadores y las galerías de muestra: queda activa enseguida, sin cobro, hasta que termines la cortesía. Si ya tenía una galería sin pagar, vuelve con lo que había armado.
            Con el mismo formulario le podés sumar monedas a quien ya tiene la cortesía.
          </p>
          <form action={grantCourtesy} className="mt-4 space-y-3">
            {/* A fresh one each time the form is drawn: a double click gifts the coins once. */}
            <input type="hidden" name="reference" value={crypto.randomUUID()} />
            <label className="block text-sm font-semibold text-ink">
              Email de su cuenta
              <input name="email" type="email" required placeholder="email@gmail.com" className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold text-ink">
              Nombre de la galería <span className="font-normal text-muted-foreground">(opcional)</span>
              <input name="title" maxLength={120} placeholder="El nombre de su perfil" className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold text-ink">
              Monedas de regalo
              <input name="coins" type="number" min={0} max={MAX_COURTESY_COINS} step={1} defaultValue={600} className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <p className="text-xs text-muted-foreground">600 es lo que trae la cuota de un mes. Un tema cuesta 1.200 y la sala de 14 obras, 2.500.</p>
            <SubmitButton size="sm">Dar la cortesía</SubmitButton>
          </form>
        </div>

        <div className="overflow-x-auto rounded-2xl border-2 border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Galería</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Cobro</th>
                <th className="px-4 py-3 text-right">Monedas</th>
                <th className="px-4 py-3 text-right">Obras</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {galleries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Todavía no hay galerías.</td></tr>
              )}
              {galleries.map((g) => {
                const meta = STATUS[g.status] ?? { label: g.status, className: 'bg-muted text-muted-foreground' }
                return (
                  <tr key={g.id} className="border-t border-ink/10 align-top">
                    <td className="px-4 py-3">
                      {g.status === 'active'
                        ? <Link href={`/club/${g.slug}`} className="font-medium text-ink underline">{g.title}</Link>
                        : <p className="font-medium text-ink">{g.title}</p>}
                      <p className="text-muted-foreground">{g.email}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.courtesy_granted_at && <p className="font-semibold text-ink">Cortesía desde el {fmtDate(g.courtesy_granted_at)}</p>}
                      {g.subscription_status ? <p>{SUBSCRIPTION[g.subscription_status] ?? g.subscription_status}</p> : !g.courtesy_granted_at && <p>—</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{g.balance.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{g.hung}</td>
                    <td className="px-4 py-3">
                      {g.courtesy_granted_at && (
                        <form action={endCourtesy}>
                          <input type="hidden" name="id" value={g.id} />
                          <SubmitButton size="sm" variant="outline">Terminar cortesía</SubmitButton>
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
    </div>
  )
}
