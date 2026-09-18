import { Plus } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { CardListSkeleton } from '@/components/admin/admin-skeletons'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Plantillas"
        action={
          <Button className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        }
      />
      <CardListSkeleton rows={4} />
    </div>
  )
}
