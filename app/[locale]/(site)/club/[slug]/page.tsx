import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClubGame } from '@/components/gallery/ClubGame'
import { clubGalleryTemplates } from '@/components/gallery/world/roomsData'
import { getClubGalleryBySlug } from '@/lib/club-galleries'

export const revalidate = 3600

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const gallery = await getClubGalleryBySlug(slug)
  if (!gallery) return {}
  return {
    title: `${gallery.title} | Club del Mundial de Collage`,
    description: gallery.statement,
    alternates: { canonical: `/club/${gallery.slug}` },
  }
}

export default async function ClubGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const gallery = await getClubGalleryBySlug(slug)
  if (!gallery) notFound()

  return (
    <ClubGame
      artworks={gallery.artworks}
      themeOverride={gallery.theme}
      template={clubGalleryTemplates[gallery.templateId]}
      presenceTopic={`gallery:club:${gallery.slug}`}
      clubSlug={gallery.slug}
      ownerKey={gallery.ownerKey}
      clubHost={{
        avatarId: gallery.hostAvatarId,
        artistName: gallery.artistName,
        title: gallery.title,
        statement: gallery.statement,
        contact: gallery.contactWhatsapp || gallery.contactUrl ? { whatsapp: gallery.contactWhatsapp, url: gallery.contactUrl } : undefined,
      }}
    />
  )
}

