import type { Metadata } from 'next'
import { Bell } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { NotificationsPageList } from '@/components/notifications/notifications-page-list'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getI18n } from '@/lib/i18n/server'
import { getUnreadNotificationCount } from '@/lib/notifications/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.notifications.metaTitle, robots: { index: false } }
}

// Everything the bell has ever shown this person, page by page.
export default async function NotificationsPage() {
  const { m } = await getI18n()
  const t = m.notifications
  const user = isSupabaseConfigured ? await getCurrentUser() : null

  return (
    <>
      <SiteHeader />
      <main className="bg-grain min-h-[70vh] py-12 sm:py-20">
        <section className="relative mx-auto max-w-2xl px-4 sm:px-8">
          {user ? (
            <NotificationsPageList
              initialUnread={await getUnreadNotificationCount()}
              isAdmin={ADMIN_EMAILS.includes(user.email ?? '')}
              heading={t.title}
            />
          ) : (
            <div className="text-center">
              <Bell className="mx-auto h-12 w-12 text-collage-blue" aria-hidden="true" />
              <h1 className="font-display mt-6 text-4xl tracking-tight uppercase sm:text-5xl">{t.title}</h1>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">{t.signIn}</p>
              <div className="mt-8 flex justify-center">
                <GoogleSignInButton next="/notificaciones" />
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
