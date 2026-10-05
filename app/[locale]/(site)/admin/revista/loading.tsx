import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Tienda" title="Revista" description={adminDescription('/admin/revista')} />
      <StatPillsSkeleton count={3} />
      <TableSkeleton rows={8} cols={7} />
    </div>
  )
}
