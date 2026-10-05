import { Plus } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { CardListSkeleton } from '@/components/admin/admin-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Campañas"
        description={adminDescription('/admin/campanas')}
        action={
          <Button className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Button>
        }
      />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-[180px] rounded-2xl" />
      <CardListSkeleton rows={4} />
    </div>
  )
}
