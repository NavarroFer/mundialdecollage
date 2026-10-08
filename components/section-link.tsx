'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// A `/#section` link that also works when you're already on that page: the
// router skips the jump when only the hash matches (or it's already in the
// URL), so here we scroll ourselves. From other pages it's a plain Link.
export function SectionLink({ href, onClick, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname()
  const [path, id] = href.split('#')

  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || !id || (path || '/') !== pathname) return
        const target = document.getElementById(id)
        if (!target) return
        e.preventDefault()
        // No explicit behavior: the CSS scroll-behavior (smooth, auto under
        // reduced motion) and scroll-padding-top apply.
        target.scrollIntoView({ block: 'start' })
        history.replaceState(history.state, '', `#${id}`)
      }}
    />
  )
}
