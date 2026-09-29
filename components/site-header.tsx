import Link from 'next/link'
import Image from 'next/image'
import { Boxes, CheckCircle2, ShieldCheck, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { LanguageSwitcher } from '@/components/language-switcher'
import { TrackedLink } from '@/components/track'

async function AuthSlot() {
  if (!isSupabaseConfigured) return null

  const { m } = await getI18n()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Hidden on phones, where «Participar» needs the room — it leads to the
  // same Google sign-in through /onboarding anyway.
  if (!user) {
    return (
      <div className="hidden sm:block">
        <GoogleSignInButton compact />
      </div>
    )
  }

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
        {firstName ? fmt(m.header.helloName, { name: firstName }) : m.header.hello}
        {isParticipating && (
          <CheckCircle2
            className="h-4 w-4 text-collage-blue"
            aria-label={m.header.participating}
          />
        )}
      </span>
      {isAdmin && (
        <Link href="/admin">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            {m.header.adminPanel}
          </Button>
        </Link>
      )}
      <SignOutButton />
    </div>
  )
}

export async function SiteHeader() {
  const { m } = await getI18n()
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink/10 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/#top" className="flex items-center gap-2.5 transition-opacity duration-300 hover:opacity-75">
          <Image src="/logo-mark.png" alt="" width={512} height={512} className="h-9 w-9" />
          <Image
            src="/wordmark.png"
            alt="Mundial de Collage"
            width={949}
            height={322}
            className="hidden h-6 w-auto sm:block"
          />
        </Link>

        <nav className="flex items-center gap-6 text-sm font-semibold text-ink/70" aria-label={m.header.nav}>
          <Link href="/tienda" className="flex min-h-11 items-center gap-1.5 whitespace-nowrap text-collage-blue hover:opacity-80">
            <Store className="h-4 w-4" aria-hidden="true" />
            Shop
          </Link>
          <Link href="/#participantes" className="hidden transition-colors duration-300 hover:text-ink md:block">
            {m.header.participants}
          </Link>
          <Link
            href="/galeria-3d"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-collage-blue hover:opacity-80"
          >
            <Boxes className="h-4 w-4" aria-hidden="true" />
            {m.header.gallery3d}
            <span className="sr-only"> {m.common.opensInNewTab}</span>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <AuthSlot />
          <Button asChild size="sm">
            <TrackedLink href="/onboarding" event="submit_click_header">
              {m.header.participate}
            </TrackedLink>
          </Button>
        </div>
      </div>
    </header>
  )
}
