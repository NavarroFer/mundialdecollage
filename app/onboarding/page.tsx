import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { OnboardingForm } from './onboarding-form'
import { completeOnboarding } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!isSupabaseConfigured) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarded_at) redirect('/')

  const { error } = await searchParams
  const suggestedName = (user.user_metadata?.full_name as string | undefined) ?? ''

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
          Anotá tu obra
        </p>
        <h1 className="font-display mt-3 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          Sumate al Mundial
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-muted-foreground">
          Contanos quién sos y subí tu collage — así aparece en el directorio de
          participantes y en la Primera Edición.
        </p>

        <OnboardingForm
          action={completeOnboarding}
          defaultName={suggestedName}
          error={error}
        />
      </div>
    </main>
  )
}
