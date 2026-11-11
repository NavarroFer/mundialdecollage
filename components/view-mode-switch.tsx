'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Palette, ShieldCheck } from 'lucide-react'
import { setViewMode } from '@/components/view-mode-actions'

// Visible on purpose: the same choice used to live only inside the avatar
// menu, which the feed home and the admin panel made easy to miss.
export function ViewModeSwitch({
  adminView,
  artistLabel,
  adminLabel,
}: {
  adminView: boolean
  artistLabel: string
  adminLabel: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const Icon = adminView ? Palette : ShieldCheck
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        await setViewMode(adminView ? 'artist' : 'admin')
        router.refresh()
      })}
      className="inline-flex h-11 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full border-2 border-ink/15 bg-paper px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-60 sm:max-w-none sm:text-sm"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {adminView ? artistLabel : adminLabel}
    </button>
  )
}
