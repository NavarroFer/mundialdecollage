import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'

const navItems = [
  { href: '/admin/contactos', label: 'Contactos' },
  { href: '/admin/plantillas', label: 'Plantillas' },
  { href: '/admin/campanas', label: 'Campañas' },
  { href: '/admin/inscripciones', label: 'Inscripciones' },
]

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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-5 py-4 sm:px-8">
          <Link href="/admin" className="font-display text-lg tracking-tight text-ink uppercase">
            Admin
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm font-semibold text-muted-foreground">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="ml-auto text-sm text-muted-foreground hover:text-ink">
            Volver al sitio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  )
}
