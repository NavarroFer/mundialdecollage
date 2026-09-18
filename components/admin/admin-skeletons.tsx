import { Skeleton } from '@/components/ui/skeleton'

export function StatPillsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[60px] w-36 rounded-2xl" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-ink/10 first:border-t-0">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-4">
                  <Skeleton className="h-4 w-full max-w-[140px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-8 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-card px-5 py-4"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function GallerySkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="mt-1.5 h-4 w-3/4" />
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1.5 h-10 w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1.5 h-10 w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1.5 h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-[400px] w-full rounded-xl" />
      </div>
    </div>
  )
}
