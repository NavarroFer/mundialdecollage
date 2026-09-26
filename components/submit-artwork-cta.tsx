'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/track'
import { useI18n } from '@/lib/i18n/client'

export function SubmitArtworkCta() {
  const { m } = useI18n()
  return (
    <Button asChild size="lg" variant="primary" className="h-18 w-full gap-3 px-10 text-xl shadow-lg sm:w-auto sm:text-2xl">
      <TrackedLink href="/onboarding" event="submit_click_hero">
        {m.hero.submit}
        <ArrowRight className="size-6" aria-hidden="true" />
      </TrackedLink>
    </Button>
  )
}
