import { Button } from '@/components/ui/button'
import { site } from '@/lib/site'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink/10 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 rotate-[-6deg] items-center justify-center rounded-md bg-collage-blue text-sm font-black text-primary-foreground">
            M
          </span>
          <span className="font-display text-lg leading-none tracking-wide text-ink">
            MUNDIAL
            <span className="block text-[0.6rem] font-sans font-semibold tracking-[0.25em] text-muted-foreground">
              DE COLLAGE
            </span>
          </span>
        </a>

        <a href={`mailto:${site.email}`}>
          <Button size="sm" className="hidden sm:inline-flex">
            Participar
          </Button>
        </a>
      </div>
    </header>
  )
}
