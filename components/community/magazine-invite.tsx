import Link from 'next/link'
import { BookOpen } from 'lucide-react'

/**
 * One invitation to the magazine, laid between two obras of the feed: close
 * enough to be seen while scrolling, but never above the tabs or in the way
 * of the navigation. It is a list item because the feed is a list.
 */
export function MagazineInvite({ href, title, cta }: { href: string; title: string; cta: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-ink bg-collage-yellow px-5 py-5 text-ink shadow-[4px_4px_0_0_var(--ink)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-collage-blue motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 sm:px-6"
      >
        <BookOpen aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 size-28 opacity-[0.14]" strokeWidth={1.25} />
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper">
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
