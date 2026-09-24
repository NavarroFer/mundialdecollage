'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'

// A client component so it can sit both in server sections (the hero) and
// inside the client-side invitation popup.
export function SubmitArtworkCta() {
  const { m } = useI18n()
  return (
    <Button asChild size="lg" variant="primary" className="h-18 w-full gap-3 px-10 text-xl shadow-lg sm:w-auto sm:text-2xl">
      <Link href="/onboarding">
        {m.hero.submit}
        <ArrowRight className="size-6" aria-hidden="true" />
      </Link>
    </Button>
  )
}
