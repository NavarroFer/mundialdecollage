import { Award, CircleCheck, Download, Lock } from 'lucide-react'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubmissionsCount } from '@/lib/submissions'
import { loadCertificateOverview, type CertificateOverview } from '@/lib/certificate-mail'
import { site } from '@/lib/site'
import { closeCall, reopenCall, sendPendingCertificates } from './actions'

// Closing mails every certificate from the server action, in batches of 100;
// a page's maxDuration is what its server actions get.
export const maxDuration = 300

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})

// Open / closed state of the 1st edition's call, and the button that closes
// it. Closing is by hand (the announced date can move): what it changes is
// listed right next to the button.
export default async function ConvocatoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cerrada?: string; enviados?: string; fallidos?: string }>
}) {
  const { error, cerrada, enviados, fallidos } = await searchParams
  const db = createAdminClient()
  const [{ data: state, error: stateError }, received] = await Promise.all([
    db.from('call_state').select('closed_at, closed_by').eq('id', true).maybeSingle(),
    getSubmissionsCount(),
  ])
  const closedAt = state?.closed_at ?? null
  // Only once closed: before that there's nothing to send yet.
  let certificates: CertificateOverview | null = null
  let certificatesError: string | null = null
  if (closedAt) {
    try {
      certificates = await loadCertificateOverview(db)
    } catch (err) {
      certificatesError = err instanceof Error ? err.message : String(err)
    }
  }

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estado de la convocatoria" description={adminDescription('/admin/convocatoria')} />
      {(error || stateError) && <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ?? stateError?.message}</p>}
      {(cerrada || enviados) && (
        <p role="status" className="mt-4 rounded-lg bg-collage-blue/10 p-3 text-sm text-collage-blue">
          {[
            cerrada && 'Listo: la convocatoria quedó cerrada.',
            enviados && `Certificados enviados: ${enviados}.`,
            fallidos && `Fallaron: ${fallidos} (podés reintentarlos abajo).`,
          ].filter(Boolean).join(' ')}
        </p>
      )}

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
              'Cada artista ya puede descargar su certificado de participación, con la fecha de hoy.',
            ].map((line) => (
              <li key={line} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-collage-blue" aria-hidden />{line}</li>
            ))}
          </ul>
          <form action={closeCall} className="mt-5">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="sendCertificates" defaultChecked className="mt-0.5 size-4 accent-collage-red" />
              <span>
                <span className="font-semibold">Enviar los certificados por mail ahora</span>
                <span className="block text-muted-foreground">A cada artista participante, en su idioma, con links para descargarlos sin iniciar sesión. Puede tardar un par de minutos: no cierres la página.</span>
              </span>
            </label>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="block text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Escribí FINALIZAR para confirmar</span>
                <input name="confirm" required autoComplete="off" className="mt-1 w-56 rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm" />
              </label>
              <SubmitButton pendingLabel="Finalizando…" className="bg-collage-red text-paper hover:bg-collage-red/90">Finalizar convocatoria</SubmitButton>
            </div>
          </form>
        </section>
      )}

      {closedAt && <CertificatesSection overview={certificates} error={certificatesError} />}
    </div>
  )
}

// What went out of the certificate mail (lib/certificate-mail.ts), the
// button that sends the rest (never sent or failed), and a preview.
function CertificatesSection({ overview, error }: { overview: CertificateOverview | null; error: string | null }) {
  const link = 'inline-flex items-center gap-1.5 text-sm font-semibold text-collage-blue underline underline-offset-4'
  return (
    <section className="mt-8 rounded-2xl border-2 border-collage-yellow/40 bg-collage-yellow/10 p-6">
      <h2 className="flex items-center gap-2 font-display text-2xl tracking-tight text-ink uppercase"><Award className="size-6 text-collage-red" aria-hidden />Certificados</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cada artista participante recibe un mail, en su idioma, con su diploma (PDF) y la imagen para Instagram. La redacción se edita en Plantillas («Certificado de participación»).
      </p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error}</p>}
      {overview && (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatPill label="Participantes" value={overview.total} />
            <StatPill label="Enviados" value={overview.sent} />
            <StatPill label="Fallidos" value={overview.failed} />
            <StatPill label="Pendientes" value={overview.pending} />
            {overview.sending > 0 && <StatPill label="Quedaron enviándose" value={overview.sending} />}
            {overview.unreachable.length > 0 && <StatPill label="Sin poder enviar" value={overview.unreachable.length} />}
          </div>
          {overview.sending > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              «Quedaron enviándose»: un envío se cortó a mitad de camino y no se sabe si esos mails salieron. No se reintentan solos, para no mandarlos dos veces.
            </p>
          )}
          {overview.unreachable.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-ink">Por qué no se les puede enviar a {overview.unreachable.length}</summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {overview.unreachable.map(({ row, reason }) => (
                  <li key={row.profile_id}>{row.artist_name || row.email || row.artwork_slug}: {reason}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            {overview.toSend.length > 0 && (
              <form action={sendPendingCertificates}>
                <SubmitButton size="sm" pendingLabel="Enviando…">Enviar certificados pendientes ({overview.toSend.length})</SubmitButton>
              </form>
            )}
            {overview.sampleSlug && (
              <>
                <a href={`/obras/${overview.sampleSlug}/certificado?formato=pdf`} className={link}><Download className="size-4" aria-hidden />Ver un diploma</a>
                <a href={`/obras/${overview.sampleSlug}/certificado?formato=imagen`} className={link}><Download className="size-4" aria-hidden />Ver una imagen</a>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
