'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DepthCarousel } from '@/components/depth-carousel'
import { countryCodeToFlag } from '@/lib/participants'
import type { Finalist } from '@/lib/finalists'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

export function ObrasCarousel({ finalists }: { finalists: Finalist[] }) {
  const [active, setActive] = useState(0)
  const { m } = useI18n()
  const current = finalists[active]

  const items = finalists.map((f) => ({
    image: f.imageUrl,
    alt: fmt(m.common.artworkBy, { title: f.artworkTitle ?? m.common.untitled, name: f.name }),
  }))

  return (
    <div>
      <div className="relative mx-auto h-[420px] max-w-5xl sm:h-[480px]">
        <DepthCarousel
          items={items}
          cardWidth={240}
          cardHeight={320}
          autoplay
          autoplayDelay={3500}
          onChange={(index) => setActive(index)}
        />
      </div>

      {current && (
        <div className="mt-6 text-center">
          <Link href={`/obras/${current.slug}`} className="group inline-block">
            <p className="flex items-center justify-center gap-2 font-semibold text-ink">
              <span aria-hidden>{countryCodeToFlag(current.countryCode)}</span>
              {current.name}
            </p>
            <p className="mt-1 text-sm text-ink/80 italic group-hover:underline">{current.artworkTitle ?? m.common.untitled}</p>
          </Link>
        </div>
      )}
    </div>
  )
}
