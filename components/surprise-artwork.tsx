import { Shuffle } from 'lucide-react'
import { TrackedAnchor } from '@/components/track'

export function SurpriseArtwork({ label, exclude }: { label: string; exclude?: string }) {
  const href = `/api/artworks/surprise${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ''}`
  return (
    <TrackedAnchor
      href={href}
      rel="nofollow"
      event={exclude ? 'surprise_click_artwork' : 'surprise_click_home'}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-collage-yellow px-6 py-3 font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue motion-reduce:transition-none"
    >
      <Shuffle className="size-5" aria-hidden="true" />
      {label}
    </TrackedAnchor>
  )
}
