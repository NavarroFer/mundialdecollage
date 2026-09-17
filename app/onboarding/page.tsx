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
    .select('name, location')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.name && profile?.location) redirect('/')

  const { error } = await searchParams
  const suggestedName = (user.user_metadata?.full_name as string | undefined) ?? ''

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
          Un último paso
        </p>
        <h1 className="font-display mt-3 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          Completá tu perfil
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-muted-foreground">
          Con tu nombre y tu ubicación ya podés participar de todo lo que suma el
          Mundial de Collage.
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
