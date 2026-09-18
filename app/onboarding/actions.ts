'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { slugify } from '@/lib/slug'
import { ALLOWED_IMAGE_EXTENSIONS } from '@/lib/onboarding-image'

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
  // The image itself is uploaded client-side straight to Supabase Storage
  // (see onboarding-form.tsx) — Vercel's Server Action body limit (~4.5MB)
  // sits well under the photos people actually submit. This action only
  // gets the resulting storage path back.
  const imagePath = String(formData.get('artwork_image_path') ?? '').trim()

  if (!name || !countryCode || !artworkTitle) {
    redirect('/onboarding?error=missing_fields')
  }
  if (!imagePath) {
    redirect('/onboarding?error=missing_image')
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

  // The upload RLS policy already confines writes to `${uid}/...`, but the
  // path arrives here as plain form data — re-check it wasn't tampered with
  // before we treat it as this user's own file.
  const [folder, filename] = imagePath.split('/')
  const extension = filename?.split('.').pop()?.toLowerCase()
  if (folder !== user.id || !filename || !extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    redirect('/onboarding?error=invalid_image')
  }

  const { data: existingFiles } = await supabase.storage.from('artworks').list(folder, {
    search: filename,
  })
  if (!existingFiles?.some((file) => file.name === filename)) {
    redirect('/onboarding?error=upload_failed')
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('artworks').getPublicUrl(imagePath)

  // slugify() strips anything outside [a-z0-9] — a name/title with no Latin
  // characters at all (a real possibility in an *international* contest)
  // collapses to '', which /obras/[slug] can't route to. Fall back to a
  // slice of the user id so every submission still gets a working page.
  const baseSlug = slugify(`${name}-${artworkTitle}`) || user.id.slice(0, 8)
  const slug = await uniqueSlug(supabase, baseSlug, user.id)

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
