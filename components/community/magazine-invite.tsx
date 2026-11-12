import Link from 'next/link'
import { BookOpen } from 'lucide-react'

/**
 * One invitation to the magazine, laid between two obras of the feed: close
 * enough to be seen while scrolling, but never above the tabs or in the way
 * of the navigation. It is a sheet of ochre paper held with a piece of tape,
 * like the rest of the site's collage objects, and it is a list item because
 * the feed is a list. The whole sheet is the link.
 */
export function MagazineInvite({ href, title, cta }: { href: string; title: string; cta: string }) {
  return (
    <li className="px-1 py-2">
      <Link
        href={href}
        className="group relative flex -rotate-[0.6deg] items-center gap-4 bg-collage-yellow px-5 py-6 text-ink shadow-[0_14px_22px_-12px_rgb(27_17_12/0.55)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-collage-blue motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:rotate-0 sm:px-7"
      >
        {/* White tape, because ochre tape would vanish on an ochre sheet. */}
        <span aria-hidden className="tape -top-3 left-8 -rotate-[4deg]" style={{ background: 'color-mix(in srgb, var(--paper) 88%, transparent)' }} />
        <span aria-hidden className="grain-overlay pointer-events-none absolute inset-0" />
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <BookOpen className="absolute -right-3 -bottom-4 size-28 opacity-[0.14]" strokeWidth={1.25} />
        </span>
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-paper shadow-[0_6px_10px_-6px_rgb(27_17_12/0.5)]">
          <BookOpen aria-hidden className="size-6" strokeWidth={2} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="font-display block text-xl leading-tight tracking-tight uppercase text-balance sm:text-2xl">{title}</span>
          <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5">{cta}</span>
        </span>
      </Link>
    </li>
  )
}
