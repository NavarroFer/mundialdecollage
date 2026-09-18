import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmissionsGallery } from '@/components/admin/submissions-gallery'

export default async function ObrasPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, name, country_code, technique, artwork_title, artwork_image_url, is_public, onboarded_at')
    .not('onboarded_at', 'is', null)
    .order('onboarded_at', { ascending: false })

  const submissions = (data ?? [])
    .filter((row) => row.name && row.country_code && row.artwork_title && row.artwork_image_url)
    .map((row) => ({
      id: row.id,
      name: row.name as string,
      countryCode: row.country_code as string,
      technique: row.technique ?? undefined,
      artworkTitle: row.artwork_title as string,
      imageUrl: row.artwork_image_url as string,
      isPublic: row.is_public,
    }))

  const publicCount = submissions.filter((s) => s.isPublic).length

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Obras" />

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Recibidas" value={submissions.length} />
        <StatPill label="Publicadas" value={publicCount} />
        <StatPill label="Pendientes" value={submissions.length - publicCount} />
      </div>

      <div className="mt-8">
        <SubmissionsGallery submissions={submissions} />
      </div>
    </div>
  )
}
