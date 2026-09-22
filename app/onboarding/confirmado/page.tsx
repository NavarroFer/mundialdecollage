import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Button } from '@/components/ui/button'

export default async function ConfirmationPage() {
  if (!isSupabaseConfigured) redirect('/')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/onboarding')
  const { data: artwork } = await supabase.from('artworks').select('slug')
    .eq('profile_id', user.id).order('is_selected', { ascending: false })
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!artwork) redirect('/onboarding')

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl border-2 border-ink/10 bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-collage-blue" aria-hidden="true" />
        <h1 className="font-display mt-5 text-3xl text-ink">¡Gracias por ser parte!</h1>
        <p className="mt-4 text-muted-foreground">Tus datos quedaron guardados y tenemos tu obra. Ya completaste este paso.</p>
        <p className="mt-3 text-sm text-muted-foreground">El equipo del Mundial se ocupa de la selección y publicación. Mientras tanto, podés revisar tu obra y seguir explorando.</p>
        <div className="mt-7 flex flex-col gap-3">
          <Button asChild size="lg"><Link href={`/obras/${artwork.slug}`}>Ver mi obra</Link></Button>
          <Button asChild variant="outline"><Link href="/">Volver al Mundial</Link></Button>
        </div>
      </div>
    </main>
  )
}
