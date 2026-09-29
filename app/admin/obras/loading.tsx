import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, GallerySkeleton } from '@/components/admin/admin-skeletons'
import { adminDescription } from '@/components/admin/admin-sections'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Obras" description={adminDescription('/admin/obras')} />
      <StatPillsSkeleton count={3} />
      <GallerySkeleton />
    </div>
  )
}
