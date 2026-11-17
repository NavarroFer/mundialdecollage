'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2, Palette, ShieldCheck } from 'lucide-react'
import { setViewMode } from '@/components/view-mode-actions'
import { showNotice } from '@/components/site-notice'

export type ViewModeLabels = {
  viewAsArtist: string
  viewAsAdmin: string
  viewSwitching: string
  viewNowArtist: string
  viewNowAdmin: string
}

// Switching between the admin and the artist view re-renders the whole site
// on the server, a second or two with nothing to show for it. While it runs
// the button spins and says so; once the new view is in, a notice says which
// one it is, since the page itself may look almost the same.
export function useViewModeSwitch(adminView: boolean, labels: ViewModeLabels, onDone?: () => void) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const switchView = () => start(async () => {
    await setViewMode(adminView ? 'artist' : 'admin')
    router.refresh()
    onDone?.()
    showNotice(adminView ? labels.viewNowArtist : labels.viewNowAdmin)
  })
  return { pending, switchView }
}

export function ViewModeIcon({ adminView, pending, className }: { adminView: boolean; pending: boolean; className: string }) {
  if (pending) return <Loader2 className={`${className} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
  const Icon = adminView ? Palette : ShieldCheck
  return <Icon className={className} aria-hidden="true" />
}

// Visible on purpose: the same choice used to live only inside the avatar
// menu, which the feed home and the admin panel made easy to miss.
export function ViewModeSwitch({ adminView, labels }: { adminView: boolean; labels: ViewModeLabels }) {
  const { pending, switchView } = useViewModeSwitch(adminView, labels)
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={switchView}
      className="inline-flex h-11 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full border-2 border-ink/15 bg-paper px-3 text-xs font-semibold text-ink transition-colors hover:bg-ink/5 disabled:border-collage-blue/40 disabled:bg-collage-blue/10 sm:max-w-none sm:text-sm"
    >
      <ViewModeIcon adminView={adminView} pending={pending} className="h-4 w-4" />
      {pending ? labels.viewSwitching : adminView ? labels.viewAsArtist : labels.viewAsAdmin}
    </button>
  )
}
