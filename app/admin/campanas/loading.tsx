import { Plus } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { CardListSkeleton } from '@/components/admin/admin-skeletons'
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
      <CardListSkeleton rows={4} />
    </div>
  )
}
