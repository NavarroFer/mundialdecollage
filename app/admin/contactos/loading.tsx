import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Newsletter" title="Contactos" />
      <StatPillsSkeleton count={2} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  )
}
