import Link from 'next/link'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'

async function AuthSlot() {
  if (!isSupabaseConfigured) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <GoogleSignInButton />

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
  const isAdmin = ADMIN_EMAILS.includes(user.email ?? '')

  // Admins never submit an artwork, so skip the extra profile lookup for
  // them entirely (same as app/onboarding/page.tsx).
  let isParticipating = false
  if (!isAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded_at')
      .eq('id', user.id)
      .maybeSingle()
    isParticipating = Boolean(profile?.onboarded_at)
  }

  return (
    <div className="hidden items-center gap-3 sm:flex">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink/70">
        Hola{firstName ? `, ${firstName}` : ''}
        {isParticipating && (
          <CheckCircle2
            className="h-4 w-4 text-collage-blue"
            aria-label="Ya estás participando"
          />
        )}
      </span>
      {isAdmin && (
        <Link href="/admin">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Panel admin
          </Button>
        </Link>
      )}
      <SignOutButton />
    </div>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink/10 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 rotate-[-6deg] items-center justify-center rounded-md bg-collage-blue text-sm font-black text-primary-foreground">
            M
          </span>
          <span className="font-display text-lg leading-none tracking-wide text-ink">
            MUNDIAL
            <span className="block text-[0.6rem] font-sans font-semibold tracking-[0.25em] text-muted-foreground">
              DE COLLAGE
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-ink/70 md:flex">
          <a href="#como-participar" className="hover:text-ink">
            Cómo participar
          </a>
          <a href="#taller" className="hover:text-ink">
            Taller
          </a>
          <a href="#participantes" className="hover:text-ink">
            Participantes
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <AuthSlot />
          <a href={`mailto:${site.email}`}>
            <Button size="sm" className="hidden sm:inline-flex">
              Participar
            </Button>
          </a>
        </div>
      </div>
    </header>
  )
}
