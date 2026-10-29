import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Galería 3D" title="Galerías del Club" description={adminDescription('/admin/club')} />
      <StatPillsSkeleton count={3} />
      <TableSkeleton rows={6} cols={6} />
    </div>
  )
}
