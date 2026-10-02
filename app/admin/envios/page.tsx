import { AdminPageHeader } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMailQuotas, type MailProvider, type MailQuota } from '@/lib/mail-quota'
import { RESEND_RESERVE } from '@/lib/mail'
import { updateMailProvider } from './actions'

const NAMES: Record<MailProvider, { name: string; dashboard: string; usedFor: string }> = {
  resend: {
    name: 'Resend',
    dashboard: 'https://resend.com/settings/usage',
    usedFor: `Primero para los transaccionales (recibos, jurado, avisos). En los envíos masivos, después de Brevo y guardando ${RESEND_RESERVE} por día para los transaccionales.`,
  },
  brevo: {
    name: 'Brevo',
    dashboard: 'https://app.brevo.com/billing/account/plans',
    usedFor: 'Primero para los envíos masivos (campañas, certificados, bienvenidas). Para los transaccionales, solo si Resend se quedó sin cupo.',
  },
}

const dayFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

// How much each mail provider has left (lib/mail-quota.ts) — lib/mail uses
// the same numbers to pick a provider and to leave bulk sends for another day.
export default async function EnviosPage({ searchParams }: { searchParams: Promise<{ error?: string; guardado?: string }> }) {
  const { error, guardado } = await searchParams
  let quotas: MailQuota[] = []
  let loadError: string | null = null
  try {
    quotas = await loadMailQuotas(createAdminClient())
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err)
  }

  return (
    <div>
      <AdminPageHeader eyebrow="Newsletter" title="Cupos de envío" description={adminDescription('/admin/envios')} />
      {(error || loadError) && <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ?? loadError}</p>}
      {guardado && <p role="status" className="mt-4 rounded-lg bg-collage-blue/10 p-3 text-sm text-collage-blue">Guardado.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {quotas.map((q) => <ProviderCard key={q.provider} quota={q} />)}
      </div>

      <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
        La app cuenta cada mail que manda; los proveedores no informan su consumo. Lo que sale por fuera de la app (por ejemplo, mails de inicio de sesión de Supabase) no se cuenta: si los números se alejan del panel del proveedor, copiá los de ahí en «Sincronizar consumo». El cupo diario se renueva a las 00:00 UTC (21:00 en Argentina).
      </p>
    </div>
  )
}

function Meter({ label, used, limit, hint }: { label: string; used: number; limit: number | null; hint?: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const tone = pct >= 100 ? 'bg-collage-red' : pct >= 80 ? 'bg-collage-yellow' : 'bg-collage-blue'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-ink">{used}{limit ? ` / ${limit}` : ' · sin límite'}</span>
      </div>
      {limit && (
        <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, used > 0 ? 2 : 0)}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ProviderCard({ quota: q }: { quota: MailQuota }) {
  const info = NAMES[q.provider]
  const input = 'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'
  const label = 'block text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase'
  return (
    <section className="rounded-2xl border-2 border-ink/10 bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl tracking-tight text-ink uppercase">{info.name}</h2>
        <span className="text-sm text-muted-foreground">
          Plan {q.plan ?? '—'} · {q.remaining === null ? 'sin límite' : `quedan ${q.remaining}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{info.usedFor}</p>

      <div className="mt-5 space-y-4">
        <Meter label="Hoy" used={q.usedToday} limit={q.dailyLimit} />
        <Meter label="En el ciclo" used={q.usedCycle} limit={q.monthlyLimit} hint={`Desde el ${dayFormatter.format(q.cycleStart)}`} />
      </div>

      <form action={updateMailProvider} className="mt-6 space-y-4 border-t-2 border-ink/10 pt-5">
        <input type="hidden" name="provider" value={q.provider} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-sm"><span className={label}>Plan</span><input name="plan" defaultValue={q.plan ?? ''} className={input} /></label>
          <label className="text-sm"><span className={label}>Por día</span><input name="daily_limit" inputMode="numeric" defaultValue={q.dailyLimit ?? ''} placeholder="Sin límite" className={input} /></label>
          <label className="text-sm"><span className={label}>Por mes</span><input name="monthly_limit" inputMode="numeric" defaultValue={q.monthlyLimit ?? ''} placeholder="Sin límite" className={input} /></label>
          <label className="text-sm"><span className={label}>Renueva el día</span><input name="cycle_day" inputMode="numeric" defaultValue={q.cycleDay} className={input} /></label>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Sincronizar consumo <span className="font-normal text-muted-foreground">(opcional: lo que muestra <a href={info.dashboard} target="_blank" rel="noreferrer" className="text-collage-blue underline underline-offset-4">el panel de {info.name}</a> ahora)</span></legend>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-sm">
            <label className="text-sm"><span className={label}>Usados hoy</span><input name="used_today" inputMode="numeric" className={input} /></label>
            <label className="text-sm"><span className={label}>Usados en el ciclo</span><input name="used_cycle" inputMode="numeric" className={input} /></label>
          </div>
        </fieldset>
        <SubmitButton size="sm" pendingLabel="Guardando…">Guardar</SubmitButton>
      </form>
    </section>
  )
}
