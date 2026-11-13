import { Footer } from '@/components/footer'
import { AppSidebar, type AppNavLabels } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { getCallState } from '@/lib/call-state'
import { getI18n } from '@/lib/i18n/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/view-mode'

// Desktop: a left rail. Phone: the header plus the bottom tabs that
// SiteHeader already draws. The feed column stays narrow; hubs can be wider.
export async function AppFrame({ children, narrow = false, search = false }: { children: React.ReactNode; narrow?: boolean; search?: boolean }) {
  const [{ m }, { open }, user] = await Promise.all([
    getI18n(),
    getCallState(),
    isSupabaseConfigured ? getCurrentUser() : Promise.resolve(null),
  ])
  const showParticipate = !isAdminEmail(user?.email)
  const labels: AppNavLabels = {
    home: m.header.home,
    explore: m.siteSections.explore,
    show: m.siteSections.show,
    mundial: m.siteSections.mundial,
    participate: open ? m.header.participate : m.closed.headerCta,
  }
  return (
    <>
      <AppSidebar labels={labels} showParticipate={showParticipate} />
      <div className="lg:pl-60">
        <SiteHeader deskNav={false} search={search} />
        <main className={narrow ? 'mx-auto w-full max-w-[560px] px-4 py-6 sm:py-8' : 'mx-auto w-full max-w-5xl px-5 py-10 sm:px-8'}>
          {children}
        </main>
        {!narrow && <Footer />}
      </div>
    </>
  )
}
