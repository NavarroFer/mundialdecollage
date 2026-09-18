'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { slugify } from '@/lib/slug'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// SVGs can carry <script> and get served back from Storage as-is — everything
// else in this set is a plain raster format with no executable content.
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// Stored as a full URL (rendered straight into an <a href> on /obras/[slug]),
// so this also doubles as XSS defense — only ever accept http(s), never
// javascript: or other schemes.
function normalizeWebsite(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

// The form asks for a handle ("@tu.usuario"), not a URL, but it's rendered
// the same way as website — build the real profile URL here so both the
// link target and the XSS defense live in one place.
function normalizeInstagram(value: string): string | null {
  if (!value) return null
  const handle = value
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null
}

// Finds a free artwork_slug, reusing the current user's own row if they're
// resubmitting (so their URL doesn't change every time they edit).
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  userId: string,
) {
  let slug = base
  for (let suffix = 2; ; suffix++) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('artwork_slug', slug)
      .neq('id', userId)
      .maybeSingle()
    if (!data) return slug
    slug = `${base}-${suffix}`
  }
}

export async function completeOnboarding(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/')

  const name = String(formData.get('name') ?? '').trim()
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  const technique = String(formData.get('technique') ?? '').trim()
  const artworkTitle = String(formData.get('artwork_title') ?? '').trim()
  const instagramInput = String(formData.get('instagram') ?? '').trim()
  const websiteInput = String(formData.get('website') ?? '').trim()
  const image = formData.get('artwork_image')

  if (!name || !countryCode || !artworkTitle) {
    redirect('/onboarding?error=missing_fields')
  }
  if (!(image instanceof File) || image.size === 0) {
    redirect('/onboarding?error=missing_image')
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    redirect('/onboarding?error=invalid_image')
  }
  if (image.size > MAX_IMAGE_BYTES) {
    redirect('/onboarding?error=image_too_large')
  }

  const instagram = instagramInput ? normalizeInstagram(instagramInput) : null
  if (instagramInput && !instagram) {
    redirect('/onboarding?error=invalid_instagram')
  }
  const website = websiteInput ? normalizeWebsite(websiteInput) : null
  if (websiteInput && !website) {
    redirect('/onboarding?error=invalid_website')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const extension = image.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${user.id}/${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('artworks')
    .upload(path, image, { contentType: image.type })
  if (uploadError) {
    redirect('/onboarding?error=upload_failed')
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('artworks').getPublicUrl(path)

  const slug = await uniqueSlug(supabase, slugify(`${name}-${artworkTitle}`), user.id)

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    name,
    country_code: countryCode,
    technique: technique || null,
    artwork_title: artworkTitle,
    artwork_slug: slug,
    artwork_image_url: publicUrl,
    instagram,
    website,
    onboarded_at: new Date().toISOString(),
  })
  if (error) {
    redirect('/onboarding?error=save_failed')
  }

  redirect('/')
}
