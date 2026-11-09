import Link from 'next/link'
import Image from 'next/image'
import { Boxes, DoorOpen, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountMenu } from '@/components/account-menu'
import { artistProfileSlug } from '@/lib/artist-slug'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getI18n } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/language-switcher'
import { TrackedLink } from '@/components/track'
import { SiteHeaderMotion } from '@/components/site-header-motion'
import { SectionLink } from '@/components/section-link'
import { getCallState } from '@/lib/call-state'
import { NotificationsSlot } from '@/components/notifications/notifications-slot'
import { MobileTabBar } from '@/components/mobile-tab-bar'
import { TermsPromptSlot } from '@/components/terms-prompt-slot'

async function AccountSlot() {
  if (!isSupabaseConfigured) return null

  const { m } = await getI18n()
  const labels = {
    account: m.header.account,
    hello: m.header.hello,
    myGallery: m.header.myGallery,
    shop: m.header.shop,
    adminPanel: m.header.adminPanel,
  }

  const user = await getCurrentUser()
  if (!user) return <AccountMenu labels={labels} signedIn={false} />

  const isAdmin = ADMIN_EMAILS.includes(user.email ?? '')
  const fullName = user.user_metadata?.full_name as string | undefined

  // Admins never submit an artwork, so skip the profile lookups for them
  // entirely (same as app/onboarding/page.tsx).
  let name = fullName?.split(' ')[0]
  let profileHref: string | undefined
  let thumbUrl: string | undefined
  if (!isAdmin) {
    const supabase = await createClient()
    const [{ data: profile }, { data: artwork }] = await Promise.all([
      supabase.from('profiles').select('onboarded_at, name').eq('id', user.id).maybeSingle(),
      // Their own session reads their own obras (owner policy): the selected one first.
      supabase
        .from('artworks')
        .select('image_url')
        .eq('profile_id', user.id)
        .is('archived_at', null)
        .not('image_url', 'is', null)
        .order('is_selected', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (profile?.name) name = profile.name.split(' ')[0]
    // A participating artist gets their profile and the thumbnail of their obra.
    if (profile?.onboarded_at && profile.name) {
      profileHref = `/artistas/${artistProfileSlug(profile.name, user.id)}`
      thumbUrl = artwork?.image_url ?? undefined
    }
  }

  return <AccountMenu labels={labels} signedIn name={name} profileHref={profileHref} thumbUrl={thumbUrl} isAdmin={isAdmin} />
}

export async function SiteHeader() {
  // «Participar» becomes «Ver las obras» once the call closes.
  const [{ m }, { open: callOpen }] = await Promise.all([getI18n(), getCallState()])
  return (
    <>
      <SiteHeaderMotion>
        <div className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-3 transition-[min-height,padding] duration-300 ease-out group-data-[scrolled=true]/header:min-h-[4.25rem] group-data-[scrolled=true]/header:py-2 motion-reduce:transition-none sm:px-8 lg:min-h-[5.5rem] lg:group-data-[scrolled=true]/header:min-h-[4.75rem]">
          <Link href="/#top" className="group flex shrink-0 items-center gap-2.5 transition-opacity duration-300 hover:opacity-75 focus-visible:rounded-lg">
            <Image src="/logo-mark.png" alt="" width={512} height={512} sizes="40px" className="h-10 w-10 transition-[height,width,transform] duration-300 ease-out group-data-[scrolled=true]/header:h-8 group-data-[scrolled=true]/header:w-8 motion-reduce:transition-none group-hover:rotate-[-4deg]" />
            <Image
              src="/wordmark.png"
              alt="Mundial de Collage"
              width={949}
              height={322}
              sizes="83px"
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
            <Link href="/club" className="flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-ink/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-paper hover:text-ink hover:shadow-sm active:translate-y-0 motion-reduce:transition-none">
              <DoorOpen className="h-4 w-4" aria-hidden="true" />
              {m.header.club}
            </Link>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher className="px-2" />
            <NotificationsSlot />
            <Button asChild className="h-11 px-5 text-sm transition-all duration-300 ease-out group-data-[scrolled=true]/header:h-10 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 motion-reduce:transition-none">
              <TrackedLink href={callOpen ? "/onboarding" : "/galeria-3d"} event="submit_click_header">
                {callOpen ? m.header.participate : m.closed.headerCta}
              </TrackedLink>
            </Button>
            <AccountSlot />
          </div>

          {/* Phones: the bell and the avatar up here; the sections live in MobileTabBar. */}
          <div className="flex items-center gap-1 lg:hidden">
            <NotificationsSlot />
            <AccountSlot />
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
          gallery3d: m.header.gallery3d,
          club: m.header.club,
          opensInNewTab: m.common.opensInNewTab,
        }}
      />
      <TermsPromptSlot />
    </>
  )
}
