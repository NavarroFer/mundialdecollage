import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { AdminNav } from '@/components/admin/admin-nav'
import { NotificationsSlot } from '@/components/notifications/notifications-slot'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect('/')

  const user = await getCurrentUser()

  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) redirect('/')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-ink/10 bg-card">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Image
                src="/logo-mark.png"
                alt=""
                width={512}
                height={512}
                className="h-9 w-9 rounded-md"
              />
              <span className="font-display text-lg leading-none tracking-wide text-ink">
                PANEL
                <span className="block text-[0.6rem] font-sans font-semibold tracking-[0.25em] text-muted-foreground">
                  ADMINISTRACIÓN
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al sitio
              </Link>
              <NotificationsSlot />
            </div>
          </div>
          <div className="mt-4 border-t border-ink/10 pt-3">
            <AdminNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">{children}</main>
    </div>
  )
}
