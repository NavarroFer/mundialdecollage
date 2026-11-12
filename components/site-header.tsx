import Link from 'next/link'
import Image from 'next/image'
import { Compass, Landmark, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountMenu } from '@/components/account-menu'
import { artistProfileSlug } from '@/lib/artist-slug'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isAdminEmail, isAdminView } from '@/lib/view-mode'
import { getI18n } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/language-switcher'
import { TrackedLink } from '@/components/track'
import { SiteHeaderMotion } from '@/components/site-header-motion'
import { getCallState } from '@/lib/call-state'
import { NotificationsSlot } from '@/components/notifications/notifications-slot'
import { MobileTabBar } from '@/components/mobile-tab-bar'
import { TermsPromptSlot } from '@/components/terms-prompt-slot'
import { SignInButton } from '@/components/sign-in-button'
import { ViewModeSwitch } from '@/components/view-mode-switch'
import { ArtworkSearch } from '@/components/artwork-search'

async function AccountSlot() {
  if (!isSupabaseConfigured) return null

  const { m } = await getI18n()
  const labels = {
    account: m.header.account,
    hello: m.header.hello,
    myGallery: m.header.myGallery,
    editProfile: m.header.editProfile,
    shop: m.header.shop,
    adminPanel: m.header.adminPanel,
    viewAsArtist: m.header.viewAsArtist,
    viewAsAdmin: m.header.viewAsAdmin,
  }

  const user = await getCurrentUser()
  if (!user) return <AccountMenu labels={labels} signedIn={false} />

  // An admin can switch to seeing the site as an artist (lib/view-mode.ts).
  const isAdmin = isAdminEmail(user.email)
  const adminView = await isAdminView(user)
  const fullName = user.user_metadata?.full_name as string | undefined

  // An admin seen as an admin never submits an artwork, so skip the profile
  // lookups for them entirely (same as app/onboarding/page.tsx).
  let name = fullName?.split(' ')[0]
  let profileHref: string | undefined
  let thumbUrl: string | undefined
  if (!adminView) {
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

  return <AccountMenu labels={labels} signedIn name={name} profileHref={profileHref} thumbUrl={thumbUrl} isAdmin={isAdmin} adminView={adminView} />
}

// `search` puts the obra search in the header: in the slot the section nav
// leaves empty on desktop, and as a second row on phones.
export async function SiteHeader({ deskNav = true, search = false }: { deskNav?: boolean; search?: boolean } = {}) {
  // «Participar» becomes «Ver las obras» once the call closes.
  const [{ m }, { open: callOpen }, user] = await Promise.all([
    getI18n(),
    getCallState(),
    isSupabaseConfigured ? getCurrentUser() : Promise.resolve(null),
  ])
  const isAdmin = isAdminEmail(user?.email)
  const adminView = user ? await isAdminView(user) : false
  const signIn = () => !user ? <SignInButton label={m.header.logIn} pendingLabel={m.auth.signingIn} /> : null
  const viewSwitch = () => isAdmin ? <ViewModeSwitch adminView={adminView} artistLabel={m.header.viewAsArtist} adminLabel={m.header.viewAsAdmin} /> : null
  return (
    <>
      <SiteHeaderMotion>
        <div className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-3 transition-[min-height,padding] duration-300 ease-out group-data-[scrolled=true]/header:min-h-[4.25rem] group-data-[scrolled=true]/header:py-2 motion-reduce:transition-none sm:px-8 lg:min-h-[5.5rem] lg:group-data-[scrolled=true]/header:min-h-[4.75rem]">
          <Link href="/#top" className="group flex min-h-11 shrink-0 items-center gap-2.5 transition-opacity duration-300 hover:opacity-75 focus-visible:rounded-lg">
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

          {deskNav && <nav className="hidden items-center rounded-full bg-ink/[0.06] p-1.5 text-[15px] font-semibold transition-[padding] duration-300 ease-out group-data-[scrolled=true]/header:p-1 lg:flex motion-reduce:transition-none" aria-label={m.header.nav}>
            <Link href="/explorar" className="flex h-11 items-center gap-2 rounded-full px-4 text-ink/80 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-paper hover:text-ink hover:shadow-sm active:translate-y-0 motion-reduce:transition-none">
              <Search className="h-4 w-4" aria-hidden="true" />
              {m.siteSections.explore}
            </Link>
            <Link href="/muestra" className="flex h-11 items-center gap-2 rounded-full px-4 text-ink/80 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-paper hover:text-ink hover:shadow-sm active:translate-y-0 motion-reduce:transition-none">
              <Landmark className="h-4 w-4" aria-hidden="true" />
              {m.siteSections.show}
            </Link>
            <Link href="/mundial" className="flex h-11 items-center gap-2 rounded-full px-4 text-ink/80 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-paper hover:text-ink hover:shadow-sm active:translate-y-0 motion-reduce:transition-none">
              <Compass className="h-4 w-4" aria-hidden="true" />
              {m.siteSections.mundial}
            </Link>
          </nav>}

          {search && (
            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <ArtworkSearch compact signedIn={!!user} />
            </div>
          )}

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher className="px-2" />
            <NotificationsSlot />
            {viewSwitch()}
            {signIn()}
            <Button asChild className="h-11 px-5 text-sm transition-all duration-300 ease-out group-data-[scrolled=true]/header:h-10 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 motion-reduce:transition-none">
              <TrackedLink href={callOpen ? "/onboarding" : "/galeria-3d"} event="submit_click_header">
                {callOpen ? m.header.participate : m.closed.headerCta}
              </TrackedLink>
            </Button>
            <AccountSlot />
          </div>

          {/* Phones: the bell and the avatar up here; the sections live in MobileTabBar. */}
          <div className="flex items-center gap-1 lg:hidden">
            {viewSwitch()}
            {signIn()}
            <NotificationsSlot />
            <AccountSlot />
          </div>
        </div>
        {search && (
          <div className="px-4 pb-3 sm:px-8 lg:hidden">
            <ArtworkSearch compact signedIn={!!user} />
          </div>
        )}
      </SiteHeaderMotion>
      {/* Outside the <header>: its backdrop blur would pin a fixed child to the header instead of the screen. */}
      <MobileTabBar
        callOpen={callOpen}
        labels={{
          nav: m.header.nav,
          home: m.header.home,
          explore: m.siteSections.explore,
          participate: callOpen ? m.header.participate : m.closed.headerCta,
          show: m.siteSections.show,
          mundial: m.siteSections.mundial,
          opensInNewTab: m.common.opensInNewTab,
        }}
      />
      <TermsPromptSlot />
    </>
  )
}
