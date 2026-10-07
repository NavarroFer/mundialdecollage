import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isResendConfigured, getDomainStatus } from '@/lib/resend'
import { CampaignComposer } from '@/components/admin/campaign-composer'
import { CAMPAIGN_TEMPLATE_AUDIENCES } from '@/lib/template-audiences'
import { AdminPageHeader } from '@/components/admin/page-header'
import { sendCampaign, scheduleCampaign, sendTestEmail, enableOpenTracking } from '../actions'
import { earliestScheduleDay } from '@/lib/campaign-schedule'
import { isTranslatorConfigured } from '@/lib/email-translator'
import { contactLocale } from '@/lib/email-translation'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { audienceContacts, CAMPAIGN_AUDIENCES, parseAudience } from '@/lib/campaign-audience'

// A send may first translate the email into eight languages.
export const maxDuration = 300

const errorMessages: Record<string, string> = {
  missing_fields: 'Completá asunto y cuerpo.',
  resend_not_configured: 'Todavía no hay ningún proveedor de mail conectado (falta RESEND_API_KEY o BREVO_API_KEY).',
  resend_domain_not_configured: 'Falta configurar RESEND_DOMAIN_API_KEY para gestionar el dominio en Resend.',
  no_recipients: 'No hay contactos suscriptos en ese público.',
  invalid_schedule: 'Elegí hoy (antes de las 09:00) o un día posterior para programarla.',
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
  searchParams: Promise<{ error?: string; test_sent?: string; tracking_enabled?: string; audience?: string }>
}) {
  const { error, test_sent: testSent, tracking_enabled: trackingEnabled, audience: audienceParam } = await searchParams
  const audience = parseAudience(audienceParam)
  const supabase = await createClient()

  // Both audiences are counted so each option shows its size before it's
  // picked; the picked one is the same list sendCampaign will send to.
  const [{ data: templates }, everyone, withoutArtwork, profileReview, notParticipating, multipleArtworks, { data: contactCountries }, domainStatus] = await Promise.all([
    supabase
      .from('templates')
      .select('id, name, subject, body_html, body_json, translations, translations_source, audiences, system_key')
      .order('name'),
    audienceContacts(supabase, 'subscribed'),
    audienceContacts(supabase, 'no_artwork'),
    audienceContacts(supabase, 'profile_review'),
    audienceContacts(supabase, 'not_participating'),
    audienceContacts(supabase, 'multiple_artworks'),
    supabase.rpc('contact_country_codes'),
    getDomainStatus(),
  ])
  const audiences = { subscribed: everyone, no_artwork: withoutArtwork, profile_review: profileReview, not_participating: notParticipating, multiple_artworks: multipleArtworks }
  const { contacts: subscribed, error: audienceError } = audiences[audience]
  const count = subscribed.length

  // How many subscribed contacts read each language, by their country.
  const countryByContact = new Map(
    ((contactCountries ?? []) as { contact_id: string; country_code: string | null }[]).map((row) => [
      row.contact_id,
      row.country_code,
    ]),
  )
  const localeCounts = Object.fromEntries(LOCALES.map((locale) => [locale, 0])) as Record<Locale, number>
  for (const { id } of subscribed) localeCounts[contactLocale(countryByContact.get(id))] += 1

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

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">¿A quién le llega?</legend>
        {/* Links, not a form field: the count and the per-language split
            follow the choice, and a searchParams-only navigation keeps
            whatever is already written in the composer. */}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {CAMPAIGN_AUDIENCES.map((option) => {
            const active = option.value === audience
            const { contacts, error: optionError } = audiences[option.value]
            return (
              <Link
                key={option.value}
                href={option.value === 'subscribed' ? '/admin/campanas/nueva' : `/admin/campanas/nueva?audience=${option.value}`}
                replace
                scroll={false}
                aria-current={active ? 'true' : undefined}
                className={`rounded-xl border-2 px-4 py-3 text-sm ${
                  active ? 'border-collage-blue bg-collage-blue/10' : 'border-ink/10 bg-card hover:border-ink/25'
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-ink">{option.label}</span>
                  <span className="shrink-0 font-bold text-ink">{optionError ? '—' : contacts.length}</span>
                </span>
                <span className="mt-1 block text-muted-foreground">{option.description}</span>
              </Link>
            )
          })}
        </div>
      </fieldset>

      {audienceError ? (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          No se pudo armar la lista de destinatarios: {audienceError}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{count} contactos suscriptos van a recibir este mail.</p>
      )}

      <div className="mt-6">
        <CampaignComposer
          action={sendCampaign.bind(null, audience)}
          scheduleAction={scheduleCampaign.bind(null, audience)}
          earliestScheduleDay={earliestScheduleDay()}
          testAction={sendTestEmail}
          templates={templates ?? []}
          recipientCount={count}
          localeCounts={localeCounts}
          translatorConfigured={isTranslatorConfigured}
          suggestedAudiences={CAMPAIGN_TEMPLATE_AUDIENCES[audience] ?? []}
        />
      </div>
    </div>
  )
}
