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
    <>
      {showWaitlist && (
        <section aria-label={m.growth.waitlistTitle} className="border-t border-ink/10 bg-collage-blue/5 px-5 py-10 sm:px-8 sm:py-12">
          <WaitlistSignup source="footer" className="mx-auto text-center" />
        </section>
      )}
      <footer className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-7 py-8 md:grid-cols-[1fr_1fr_1.2fr] md:gap-8 md:py-10">
        <p className="font-display text-2xl tracking-tight text-ink uppercase md:text-3xl">
          {site.shortName}
        </p>
        <div>
        <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{m.footer.followUs}</h2>
        <ul className="flex flex-col items-start">
          {site.organizers.map(({ name, instagram }) => (
            <li key={name}>
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={fmt(m.common.instagramOf, { name })}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-ink underline-offset-4 hover:underline"
              >
                <Instagram className="size-4 text-collage-red" aria-hidden />
                {name}
              </a>
            </li>
          ))}
        </ul>
        </div>
        <div className="min-w-0">
        <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{m.footer.contact}</h2>
        <a
          href={`mailto:${site.email}`}
          className="inline-flex min-h-11 max-w-full items-center text-sm text-ink underline underline-offset-4 [overflow-wrap:anywhere]"
        >
          {site.email}
        </a>
        </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-ink/10 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 lg:order-2">
        <nav className="flex flex-wrap items-center gap-x-5 text-xs text-muted-foreground">
          <Link href="/terminos-y-condiciones" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {m.footer.terms}
          </Link>
          <Link href="/politica-de-privacidad" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {m.footer.privacy}
          </Link>
        </nav>
        <LanguageSwitcher />
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {site.name}
        </p>
        </div>
      </div>
    </footer>
    </>
  )
}
