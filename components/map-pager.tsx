'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Page } from '@/lib/country-pages'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatNumber } from '@/lib/i18n/format'

const buttonClass =
  'inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-bold text-collage-blue underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-50'

// Previous / "21–40 of 87" / next for a country's obras on the map. Renders
// nothing while they all fit on one page.
export function MapPager({
  page,
  onPageChange,
  className = '',
}: {
  page: Page<unknown>
  onPageChange: (page: number) => void
  className?: string
}) {
  const { locale, m } = useI18n()
  if (page.pageCount <= 1) return null

  return (
    <nav aria-label={m.map.pagesLabel} className={`flex flex-wrap items-center gap-x-2 text-sm ${className}`}>
      <button type="button" onClick={() => onPageChange(page.page - 1)} disabled={page.page === 0} className={buttonClass}>
        <ChevronLeft className="size-4" aria-hidden="true" />
        {m.map.prevPage}
      </button>
      <span className="text-muted-foreground tabular-nums">
        {fmt(m.map.pageRange, {
          from: formatNumber(locale, page.from),
          to: formatNumber(locale, page.to),
          total: formatNumber(locale, page.total),
        })}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page.page + 1)}
        disabled={page.page + 1 >= page.pageCount}
        className={buttonClass}
      >
        {m.map.nextPage}
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  )
}
