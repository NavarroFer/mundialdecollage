import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isResendConfigured } from '@/lib/resend'
import { CampaignComposer } from '@/components/admin/campaign-composer'
import { AdminPageHeader } from '@/components/admin/page-header'
import { sendCampaign } from '../actions'

const errorMessages: Record<string, string> = {
  missing_fields: 'Completá asunto y cuerpo.',
  resend_not_configured: 'Todavía no está conectado Resend (falta RESEND_API_KEY).',
  no_recipients: 'No hay contactos suscriptos para enviar.',
}

export default async function NuevaCampanaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const [{ data: templates }, { count }] = await Promise.all([
    supabase.from('templates').select('id, name, subject, body_html').order('name'),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('subscribed', true),
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
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {errorMessages[error] ?? error}
        </p>
      )}

      <p className="mt-4 text-sm text-muted-foreground">{count ?? 0} contactos suscriptos van a recibir este mail.</p>

      <div className="mt-6">
        <CampaignComposer action={sendCampaign} templates={templates ?? []} recipientCount={count ?? 0} />
      </div>
    </div>
  )
}
