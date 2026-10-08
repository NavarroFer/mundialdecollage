import Link from 'next/link'
import Image from 'next/image'
import { Boxes, CheckCircle2, ShieldCheck, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { LanguageSwitcher } from '@/components/language-switcher'
import { TrackedLink } from '@/components/track'
import { SiteHeaderMotion } from '@/components/site-header-motion'
import { SectionLink } from '@/components/section-link'
import { getCallState } from '@/lib/call-state'
import { NotificationsSlot } from '@/components/notifications/notifications-slot'
import { MobileTabBar } from '@/components/mobile-tab-bar'

async function AuthSlot() {
  if (!isSupabaseConfigured) return null

  const { m } = await getI18n()
  const supabase = await createClient()
  const user = await getCurrentUser()

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
  // «Participar» becomes «Ver las obras» once the call closes.
  const [{ m }, { open: callOpen }] = await Promise.all([getI18n(), getCallState()])
  return (
    <>
      <SiteHeaderMotion>
        <div className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-3 transition-[min-height,padding] duration-300 ease-out group-data-[scrolled=true]/header:min-h-[4.25rem] group-data-[scrolled=true]/header:py-2 motion-reduce:transition-none sm:px-8 lg:min-h-[5.5rem] lg:group-data-[scrolled=true]/header:min-h-[4.75rem]">
          <Link href="/#top" className="group flex shrink-0 items-center gap-2.5 transition-opacity duration-300 hover:opacity-75 focus-visible:rounded-lg">
            <Image src="/logo-mark.png" alt="" width={512} height={512} className="h-10 w-10 transition-[height,width,transform] duration-300 ease-out group-data-[scrolled=true]/header:h-8 group-data-[scrolled=true]/header:w-8 motion-reduce:transition-none group-hover:rotate-[-4deg]" />
            <Image
              src="/wordmark.png"
              alt="Mundial de Collage"
              width={949}
              height={322}
              className="hidden h-7 w-auto transition-[height] duration-300 ease-out group-data-[scrolled=true]/header:h-6 motion-reduce:transition-none sm:block"
            />
          </Link>

          <nav className="hidden items-center rounded-full bg-ink/[0.06] p-1.5 text-[15px] font-semibold transition-[padding] duration-300 ease-out group-data-[scrolled=true]/header:p-1 lg:flex motion-reduce:transition-none" aria-label={m.header.nav}>
            <TrackedLink href="/tienda" event="store_click_header" className="flex h-11 items-center gap-2 rounded-full bg-paper px-4 text-ink shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-collage-yellow/20 hover:shadow-md active:translate-y-0 motion-reduce:transition-none">
              <Store className="h-4 w-4" aria-hidden="true" />
              {m.header.shop}
            </TrackedLink>
            <SectionLink href="/#participantes" className="flex h-11 items-center rounded-full px-4 text-ink/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-paper hover:text-ink hover:shadow-sm active:translate-y-0 motion-reduce:transition-none">
              {m.header.participants}
            </SectionLink>
            <Link
              href="/galeria-3d"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-collage-blue transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-paper hover:shadow-sm active:translate-y-0 motion-reduce:transition-none"
            >
              <Boxes className="h-4 w-4" aria-hidden="true" />
              {m.header.gallery3d}
              <span className="sr-only"> {m.common.opensInNewTab}</span>
            </Link>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher className="px-2" />
            <NotificationsSlot />
            <AuthSlot />
            <Button asChild className="h-11 px-5 text-sm transition-all duration-300 ease-out group-data-[scrolled=true]/header:h-10 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 motion-reduce:transition-none">
              <TrackedLink href={callOpen ? "/onboarding" : "/galeria-3d"} event="submit_click_header">
                {callOpen ? m.header.participate : m.closed.headerCta}
              </TrackedLink>
            </Button>
          </div>

          {/* Phones keep only the bell up here: the rest lives in MobileTabBar. */}
          <div className="flex items-center gap-2 lg:hidden">
            <NotificationsSlot />
          </div>
        </div>
      </SiteHeaderMotion>
      {/* Outside the <header>: its backdrop blur would pin a fixed child to the header instead of the screen. */}
      <MobileTabBar
        callOpen={callOpen}
        labels={{
          nav: m.header.nav,
          home: m.header.home,
          participants: m.header.participants,
          participate: callOpen ? m.header.participate : m.closed.headerCta,
          shop: m.header.shop,
          gallery3d: m.header.gallery3d,
          opensInNewTab: m.common.opensInNewTab,
        }}
      />
    </>
  )
}
