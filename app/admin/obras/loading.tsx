import { AdminPageHeader } from '@/components/admin/page-header'
import { StatPillsSkeleton, GallerySkeleton } from '@/components/admin/admin-skeletons'

export default function Loading() {
  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Obras" />
      <StatPillsSkeleton count={3} />
      <GallerySkeleton />
    </div>
  )
}
