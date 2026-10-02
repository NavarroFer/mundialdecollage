import { redirect } from 'next/navigation'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isMercadoPagoConfigured } from '@/lib/mercadopago'
import { isWorkshopPaymentConfigured, site } from '@/lib/site'
import { registerForWorkshop } from '../actions'
import { RegistrationForm } from './registration-form'

function formatArs(amount: number) {
  return `$${amount.toLocaleString('es-AR')}`
}

type Registration = {
  payment_type: 'sena' | 'completo'
  amount_pending: number
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
}

function statusMessage(registration: Registration) {
  if (registration.status === 'paid') {
    if (registration.payment_type === 'completo') {
      return 'Ya estás anotado — pago completo. ¡Nos vemos en el taller!'
    }
    return `Ya estás anotado — seña pagada. Te faltan pagar ${formatArs(
      registration.amount_pending,
    )} en el taller (en efectivo).`
  }
  if (registration.status === 'pending') {
    return 'Tu pago está pendiente de confirmación. Te avisamos apenas se acredite — no hace falta que hagas nada más.'
  }
  if (registration.status === 'failed') {
    return `Tu pago no se pudo acreditar. Escribinos a ${site.email} y te ayudamos a resolverlo.`
  }
  return `Tu inscripción quedó cancelada. Escribinos a ${site.email} si querés anotarte igual.`
}

export default async function InscripcionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!isSupabaseConfigured || !isMercadoPagoConfigured || !isWorkshopPaymentConfigured()) {
    redirect('/')
  }

  const { totalPrice, minDeposit } = site.workshop
  if (totalPrice === null || minDeposit === null) redirect('/')

  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/')

  const { data: registration } = await supabase
    .from('workshop_registrations')
    .select('payment_type, amount_pending, status')
    .eq('user_id', user.id)
    .maybeSingle()

  let full = false
  if (!registration) {
    // Regular RLS only shows a user their own row, so a global count of
    // paid seats needs the service-role client (bypasses RLS for reads).
    const admin = createAdminClient()
    const { count } = await admin
      .from('workshop_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid')
    full = (count ?? 0) >= site.workshop.capacity
  }

  const { error } = await searchParams

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
          Taller de collage
        </p>
        <h1 className="font-display mt-3 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          Anotate al taller
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-muted-foreground">
          {site.workshop.dateLabel} en {site.workshop.locationLabel} — 20 cupos, pagás la seña o
          el total y listo.
        </p>

        {registration ? (
          <div className="mt-8 rounded-2xl border-2 border-ink/10 bg-card p-7 text-center">
            <p className="text-sm font-semibold text-ink">{statusMessage(registration)}</p>
          </div>
        ) : full ? (
          <div className="mt-8 rounded-2xl border-2 border-ink/10 bg-card p-7 text-center">
            <p className="text-sm font-semibold text-ink">
              Se completaron los 20 cupos del taller. Escribinos a {site.email} si querés que te
              avisemos ante una vacante.
            </p>
          </div>
        ) : (
          <RegistrationForm
            action={registerForWorkshop}
            minDeposit={minDeposit}
            totalPrice={totalPrice}
            error={error}
          />
        )}
      </div>
    </main>
  )
}
