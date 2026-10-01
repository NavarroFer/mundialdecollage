import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Tienda" title="Club y envíos" description={adminDescription('/admin/tienda')} />
      <StatPillsSkeleton count={4} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  )
}
