'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { slugify } from '@/lib/slug'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

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
  const instagram = String(formData.get('instagram') ?? '').trim()
  const website = String(formData.get('website') ?? '').trim()
  const image = formData.get('artwork_image')

  if (!name || !countryCode || !artworkTitle) {
    redirect('/onboarding?error=missing_fields')
  }
  if (!(image instanceof File) || image.size === 0) {
    redirect('/onboarding?error=missing_image')
  }
  if (!image.type.startsWith('image/')) {
    redirect('/onboarding?error=invalid_image')
  }
  if (image.size > MAX_IMAGE_BYTES) {
    redirect('/onboarding?error=image_too_large')
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
    instagram: instagram || null,
    website: website || null,
    onboarded_at: new Date().toISOString(),
  })
  if (error) {
    redirect('/onboarding?error=save_failed')
  }

  redirect('/')
}
