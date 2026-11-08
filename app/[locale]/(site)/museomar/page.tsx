import type { Metadata } from 'next'
import Galeria3DPage from '../galeria-3d/page'
import { getI18n } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: `Museo MAR — ${m.meta.galleryTitle}`, description: m.meta.galleryDescription }
}

/** Public door to the MAR walk. The address stays /museomar; ?museo= is not required. */
export default function MuseomarPage() {
  return <Galeria3DPage venue="mar" />
}
