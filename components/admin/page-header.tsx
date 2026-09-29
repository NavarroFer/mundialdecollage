import { SectionEyebrow } from '@/components/admin/section-eyebrow'

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
        <h1 className="font-display mt-2 text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-card px-5 py-3">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  )
}
