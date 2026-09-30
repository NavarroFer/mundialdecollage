'use client'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'

export function CollapsibleSection({
  title,
  description,
  steps,
  kpi,
  kpiLabel,
  recentKpi,
  comparisonDays,
  completion,
  children,
}: {
  title: string
  description: string
  steps: number
  kpi: number | null
  kpiLabel: string
  recentKpi: number | null
  comparisonDays: number
  completion?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const contentId = useId()

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="group flex w-full items-center justify-between gap-5 p-5 text-left transition-colors hover:bg-collage-yellow/15 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-collage-blue sm:p-6"
      >
        <div className="min-w-0">
          <h2 className="font-display text-xl tracking-tight text-ink uppercase">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {kpi !== null && (
            <span className="hidden text-right sm:block">
              <strong className="font-display block text-3xl leading-none text-collage-blue">{kpi}</strong>
              <span className="mt-1 block max-w-36 text-[10px] font-bold leading-tight tracking-wide text-muted-foreground uppercase">{kpiLabel}</span>
              <span className="mt-2 flex flex-wrap justify-end gap-x-2 gap-y-1 text-[10px] font-bold tracking-wide uppercase">
                {recentKpi !== null && <span className="text-collage-red">{recentKpi} · {comparisonDays} d</span>}
                {completion !== undefined && <span className="text-ink/65">{new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 0 }).format(completion)} al final</span>}
              </span>
            </span>
          )}
          <span className="flex items-center gap-2 rounded-full bg-collage-blue px-3 py-2 text-xs font-bold tracking-wide text-primary-foreground uppercase">
            <span className="hidden sm:inline">{open ? 'Cerrar' : `Ver ${steps} pasos`}</span>
            <ChevronDown className={`size-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </div>
      </button>

      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={contentId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t-2 border-ink/10 p-5 sm:p-6">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </section>
  )
}
