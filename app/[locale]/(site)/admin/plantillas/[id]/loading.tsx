import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { FormSkeleton } from '@/components/admin/admin-skeletons'

export default function Loading() {
  return (
    <div>
      <Link
        href="/admin/plantillas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantillas
      </Link>
      <AdminPageHeader eyebrow="Newsletter" title="Editar plantilla" />
      <FormSkeleton />
    </div>
  )
}
