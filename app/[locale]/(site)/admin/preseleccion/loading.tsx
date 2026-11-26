import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Preselección" description={adminDescription('/admin/preseleccion')} />
      <StatPillsSkeleton count={3} />
    </div>
  )
}
