import { cache } from 'react'
import type { GalleryTheme } from '@/components/gallery/themes'
import type { ClubGalleryTemplateId } from '@/components/gallery/world/roomsData'
import { clubGallerySlots, type Artwork, type GalleryFrameStyle } from '@/data/artworks'
import { cachedPublicData } from '@/lib/public-data-cache'
import { flagSvg } from '@/lib/flag-svg'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'

const CLUB_TEMPLATES = new Set<ClubGalleryTemplateId>(['cabinet', 'classic', 'double'])
const CLUB_THEMES = new Set<GalleryTheme>(['collage', 'windows98', 'garden', 'atelier', 'industrial', 'museum', 'alley'])
const FRAME_STYLES = new Set<GalleryFrameStyle>(['standard', 'wood', 'gold', 'black-mat', 'pinned'])
const EDITION_YEAR = new Date(site.deadlineISO).getFullYear()

type ClubArtworkRow = {
  slug: string | null
  title: string | null
  technique: string | null
  image_url: string | null
  profiles: { name: string | null; country_code: string | null } | null
}

export type ClubGalleryHangingRow = {
  slot: number
  frame_style: string | null
  for_sale: boolean
  price_label: string | null
  artworks: ClubArtworkRow | null
}

export type ClubGalleryRow = {
  id: string
  slug: string
  title: string
  statement: string | null
  template_id: string
  theme: string
  default_frame_style: string
  host_avatar_id: string
  host_outfit: unknown
  music_track: string
  contact_whatsapp: string | null
  contact_url: string | null
  club_gallery_hangings: ClubGalleryHangingRow[] | null
}

export type ClubGallery = {
  id: string
  slug: string
  title: string
  statement?: string
  templateId: ClubGalleryTemplateId
  theme: GalleryTheme
  defaultFrameStyle: GalleryFrameStyle
  hostAvatarId: string
  hostOutfit: unknown
  musicTrack: string
  contactWhatsapp?: string
  contactUrl?: string
  artworks: Artwork[]
}

function isTemplate(value: string): value is ClubGalleryTemplateId {
  return CLUB_TEMPLATES.has(value as ClubGalleryTemplateId)
}

function isTheme(value: string): value is GalleryTheme {
  return CLUB_THEMES.has(value as GalleryTheme)
}

function frameStyle(value: string | null | undefined, fallback: GalleryFrameStyle): GalleryFrameStyle {
  return value && FRAME_STYLES.has(value as GalleryFrameStyle) ? value as GalleryFrameStyle : fallback
}

/** Converts a public RLS row into the serializable contract consumed by the 3D client. */
export function clubGalleryFromRow(row: ClubGalleryRow): ClubGallery | undefined {
  if (!isTemplate(row.template_id) || !isTheme(row.theme)) return undefined
  const defaultFrameStyle = frameStyle(row.default_frame_style, 'standard')
  const slots = clubGallerySlots[row.template_id]
  const artworks = (row.club_gallery_hangings ?? [])
    .toSorted((left, right) => left.slot - right.slot)
    .flatMap((hanging): Artwork[] => {
      const artwork = hanging.artworks
      const slot = slots[hanging.slot - 1]
      const profile = artwork?.profiles
      if (!slot || !artwork?.slug || !artwork.image_url || !profile?.name || !profile.country_code) return []
      const technique = artwork.technique?.trim()
      return [{
        id: artwork.slug,
        title: artwork.title?.trim() || 'Sin título',
        artist: profile.name,
        countryCode: profile.country_code,
        flagSvg: flagSvg(profile.country_code),
        year: EDITION_YEAR,
        image: artwork.image_url,
        description: technique || profile.name,
        frameStyle: frameStyle(hanging.frame_style, defaultFrameStyle),
        ...slot,
      }]
    })

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    statement: row.statement?.trim() || undefined,
    templateId: row.template_id,
    theme: row.theme,
    defaultFrameStyle,
    hostAvatarId: row.host_avatar_id,
    hostOutfit: row.host_outfit,
    musicTrack: row.music_track,
    contactWhatsapp: row.contact_whatsapp?.trim() || undefined,
    contactUrl: row.contact_url?.trim() || undefined,
    artworks,
  }
}

const getPublicClubGallery = cachedPublicData(async (slug: string): Promise<ClubGallery | undefined> => {
  if (!isSupabaseConfigured) return undefined
  const { data, error } = await createPublicClient()
    .from('club_galleries')
    .select(`
      id, slug, title, statement, template_id, theme, default_frame_style,
      host_avatar_id, host_outfit, music_track, contact_whatsapp, contact_url,
      club_gallery_hangings(
        slot, frame_style, for_sale, price_label,
        artworks!inner(slug, title, technique, image_url, profiles!inner(name, country_code))
      )
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? clubGalleryFromRow(data as unknown as ClubGalleryRow) : undefined
}, 'club-gallery')

export const getClubGalleryBySlug = cache(getPublicClubGallery)

