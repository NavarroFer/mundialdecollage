import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isResendConfigured, getDomainStatus } from '@/lib/resend'
import { CampaignComposer } from '@/components/admin/campaign-composer'
import { AdminPageHeader } from '@/components/admin/page-header'
import { sendCampaign, sendTestEmail, enableOpenTracking } from '../actions'

const errorMessages: Record<string, string> = {
  missing_fields: 'Completá asunto y cuerpo.',
  resend_not_configured: 'Todavía no está conectado Resend (falta RESEND_API_KEY).',
  resend_domain_not_configured: 'Falta configurar RESEND_DOMAIN_API_KEY para gestionar el dominio en Resend.',
  no_recipients: 'No hay contactos suscriptos para enviar.',
  domain_not_found: 'El dominio configurado en site.mailFrom no aparece en la cuenta de Resend.',
}

const domainStatusLabel: Record<string, string> = {
  verified: 'verificado',
  pending: 'pendiente de verificación',
  not_started: 'sin verificar',
  failed: 'falló la verificación',
  partially_verified: 'parcialmente verificado',
  partially_failed: 'parcialmente falló',
}

export default async function NuevaCampanaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; test_sent?: string; tracking_enabled?: string }>
}) {
  const { error, test_sent: testSent, tracking_enabled: trackingEnabled } = await searchParams
  const supabase = await createClient()

  const [{ data: templates }, { count }, domainStatus] = await Promise.all([
    supabase.from('templates').select('id, name, subject, body_html, body_json').order('name'),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('subscribed', true),
    getDomainStatus(),
  ])

  return (
    <div>
      <Link
        href="/admin/campanas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a campañas
      </Link>
      <AdminPageHeader eyebrow="Newsletter" title="Nueva campaña" />

      {!isResendConfigured && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          Resend todavía no está conectado — el envío va a fallar hasta que RESEND_API_KEY esté configurada.
        </p>
      )}

      {isResendConfigured && domainStatus && !domainStatus.found && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          El dominio <strong>{domainStatus.domain}</strong> no aparece en esta cuenta de Resend — los envíos van a
          fallar hasta que se agregue y verifique en resend.com/domains.
        </p>
      )}

      {isResendConfigured && domainStatus?.found && domainStatus.status !== 'verified' && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          El dominio <strong>{domainStatus.domain}</strong> está{' '}
          {domainStatusLabel[domainStatus.status ?? ''] ?? domainStatus.status} en Resend — los envíos van a fallar
          hasta que termine de verificarse (DNS en resend.com/domains).
        </p>
      )}

      {isResendConfigured && domainStatus?.found && domainStatus.status === 'verified' && !domainStatus.openTracking && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          <p>
            El dominio está verificado pero el tracking de apertura está apagado — no vas a poder ver quién abrió los
            mails.
          </p>
          <form action={enableOpenTracking}>
            <button type="submit" className="shrink-0 font-semibold underline">
              Activarlo
            </button>
          </form>
        </div>
      )}

      {trackingEnabled && (
        <p className="mt-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          Tracking de apertura activado.
        </p>
      )}
      {testSent && (
        <p className="mt-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          Mail de prueba enviado a {testSent}.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {errorMessages[error] ?? error}
        </p>
      )}

      <p className="mt-4 text-sm text-muted-foreground">{count ?? 0} contactos suscriptos van a recibir este mail.</p>

      <div className="mt-6">
        <CampaignComposer
          action={sendCampaign}
          testAction={sendTestEmail}
          templates={templates ?? []}
          recipientCount={count ?? 0}
        />
      </div>
    </div>
  )
}
