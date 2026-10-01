import { CircleCheck, Lock } from 'lucide-react'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubmissionsCount } from '@/lib/submissions'
import { site } from '@/lib/site'
import { closeCall, reopenCall } from './actions'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})

// Open / closed state of the 1st edition's call, and the button that closes
// it. Closing is by hand (the announced date can move): what it changes is
// listed right next to the button.
export default async function ConvocatoriaPage({ searchParams }: { searchParams: Promise<{ error?: string; cerrada?: string }> }) {
  const { error, cerrada } = await searchParams
  const db = createAdminClient()
  const [{ data: state, error: stateError }, received] = await Promise.all([
    db.from('call_state').select('closed_at, closed_by').eq('id', true).maybeSingle(),
    getSubmissionsCount(),
  ])
  const closedAt = state?.closed_at ?? null

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estado de la convocatoria" description={adminDescription('/admin/convocatoria')} />
      {(error || stateError) && <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ?? stateError?.message}</p>}
      {cerrada && <p role="status" className="mt-4 rounded-lg bg-collage-blue/10 p-3 text-sm text-collage-blue">Listo: la convocatoria quedó cerrada.</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Estado" value={closedAt ? 'Cerrada' : 'Abierta'} />
        <StatPill label="Obras recibidas" value={received ?? '—'} />
        <StatPill label="Cierre anunciado" value={site.deadlineLabel} />
      </div>

      {closedAt ? (
        <section className="mt-8 rounded-2xl border-2 border-collage-blue/30 bg-collage-blue/5 p-6">
          <p className="flex items-center gap-2 font-semibold text-ink"><Lock className="size-5 text-collage-blue" aria-hidden />Cerrada el {dateFormatter.format(new Date(closedAt))}{state?.closed_by ? ` por ${state.closed_by}` : ''}.</p>
          <p className="mt-2 text-sm text-muted-foreground">El sitio ya no recibe obras de la 1ª edición. Si fue un error o se extiende el plazo, podés reabrirla.</p>
          <form action={reopenCall} className="mt-4">
            <SubmitButton size="sm" variant="outline">Reabrir convocatoria</SubmitButton>
          </form>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border-2 border-collage-red/30 bg-card p-6">
          <h2 className="font-display text-2xl tracking-tight text-ink uppercase">Finalizar convocatoria</h2>
          <p className="mt-2 text-sm text-muted-foreground">Cuando se cierra la recepción de obras de la 1ª edición. Al finalizarla:</p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {[
              'El sitio deja de recibir obras: «Participar» y «Enviá tu obra» pasan a mostrar la galería y el formulario avisa que la convocatoria cerró.',
              'Quien ya participa puede seguir viendo y confirmando sus datos, pero no sumar obras.',
              'Las filas nuevas de la planilla de Registro ya no se suman (las existentes se siguen actualizando).',
              'Se cancelan los mails de cuenta regresiva que falten.',
            ].map((line) => (
              <li key={line} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-collage-blue" aria-hidden />{line}</li>
            ))}
          </ul>
          <form action={closeCall} className="mt-5 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Escribí FINALIZAR para confirmar</span>
              <input name="confirm" required autoComplete="off" className="mt-1 w-56 rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm" />
            </label>
            <SubmitButton className="bg-collage-red text-paper hover:bg-collage-red/90">Finalizar convocatoria</SubmitButton>
          </form>
        </section>
      )}
    </div>
  )
}
