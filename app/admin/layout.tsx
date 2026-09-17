import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { AdminNav } from '@/components/admin/admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) redirect('/')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-ink/10 bg-card">
        <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 rotate-[-6deg] items-center justify-center rounded-md bg-collage-blue text-sm font-black text-primary-foreground">
                M
              </span>
              <span className="font-display text-lg leading-none tracking-wide text-ink">
                PANEL
                <span className="block text-[0.6rem] font-sans font-semibold tracking-[0.25em] text-muted-foreground">
                  ADMINISTRACIÓN
                </span>
              </span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al sitio
            </Link>
          </div>
          <div className="mt-5">
            <AdminNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">{children}</main>
    </div>
  )
}
