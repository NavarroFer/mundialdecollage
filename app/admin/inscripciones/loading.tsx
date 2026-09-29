import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Taller de collage" title="Inscripciones" description={adminDescription('/admin/inscripciones')} />
      <StatPillsSkeleton count={2} />
      <TableSkeleton rows={8} cols={8} />
    </div>
  )
}
