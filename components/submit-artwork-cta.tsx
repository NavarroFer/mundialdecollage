import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SubmitArtworkCta() {
  return (
    <Button asChild size="lg" variant="primary" className="h-18 w-full gap-3 px-10 text-xl shadow-lg sm:w-auto sm:text-2xl">
      <Link href="/onboarding">
        Enviá tu obra
        <ArrowRight className="size-6" aria-hidden="true" />
      </Link>
    </Button>
  )
}
