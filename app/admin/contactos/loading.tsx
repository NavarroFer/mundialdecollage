import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Newsletter" title="Contactos" description={adminDescription('/admin/contactos')} />
      <StatPillsSkeleton count={2} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  )
}
