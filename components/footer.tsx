import Link from 'next/link'
import { site } from '@/lib/site'

export function Footer() {
  return (
    <footer className="border-t-2 border-ink/10 bg-paper py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center sm:px-8">
        <p className="font-display text-sm tracking-[0.3em] text-ink uppercase">
          {site.tagline}
        </p>
        <a
          href={`mailto:${site.email}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          {site.email}
        </a>
        <nav className="flex items-center gap-4 text-xs text-muted-foreground/80">
          <Link href="/terminos-y-condiciones" className="underline-offset-4 hover:underline">
            Términos y Condiciones
          </Link>
          <Link href="/politica-de-privacidad" className="underline-offset-4 hover:underline">
            Política de Privacidad
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  )
}
