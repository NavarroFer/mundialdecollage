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
        <p className="text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  )
}
