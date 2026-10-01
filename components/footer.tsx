import Link from 'next/link'
import { Instagram } from 'lucide-react'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { LanguageSwitcher } from '@/components/language-switcher'
import { WaitlistSignup } from '@/components/waitlist-signup'

// showWaitlist: off on pages that already have their own «Avisame» form.
export async function Footer({ showWaitlist = true }: { showWaitlist?: boolean } = {}) {
  const { m } = await getI18n()
  return (
    <footer className="border-t-2 border-ink/10 bg-paper py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center sm:px-8">
        {showWaitlist && <WaitlistSignup source="footer" className="mb-6 border-b-2 border-ink/10 pb-8" />}
        <p className="font-display text-2xl tracking-tight text-ink uppercase">
          {site.shortName}
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {site.organizers.map(({ name, instagram }) => (
            <li key={name}>
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={fmt(m.common.instagramOf, { name })}
                className="inline-flex min-h-11 items-center gap-1.5 font-display text-sm tracking-[0.3em] text-ink uppercase underline-offset-4 hover:underline"
              >
                <Instagram className="size-4 text-collage-red" aria-hidden />
                {name}
              </a>
            </li>
          ))}
        </ul>
        <a
          href={`mailto:${site.email}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          {site.email}
        </a>
        <nav className="flex items-center gap-4 text-xs text-muted-foreground/80">
          <Link href="/terminos-y-condiciones" className="underline-offset-4 hover:underline">
            {m.footer.terms}
          </Link>
          <Link href="/politica-de-privacidad" className="underline-offset-4 hover:underline">
            {m.footer.privacy}
          </Link>
        </nav>
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground/80">
          {m.footer.googleWhy}
        </p>
        <LanguageSwitcher />
        <p className="text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  )
}
