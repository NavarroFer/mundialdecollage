import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Taller de collage" title="Inscripciones" />
      <StatPillsSkeleton count={2} />
      <TableSkeleton rows={8} cols={8} />
    </div>
  )
}
