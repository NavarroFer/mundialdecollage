import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <Skeleton className="mx-auto h-3 w-40" />
        <Skeleton className="mx-auto mt-3 h-9 w-64" />
        <Skeleton className="mx-auto mt-3 h-4 w-full max-w-sm" />
        <Skeleton className="mx-auto mt-1.5 h-4 w-2/3 max-w-sm" />

        <div className="mt-8 space-y-5 rounded-2xl border-2 border-ink/10 bg-card p-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-11 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </main>
  )
}
