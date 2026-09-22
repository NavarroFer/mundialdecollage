'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { normalizeLikeEmail, readGalleryIdentity, signGalleryIdentity } from '@/lib/gallery-identity'

const COOKIE = 'gallery-voter'
const unavailable = 'No pudimos cargar los likes. Intentá de nuevo en un momento.'

async function getIdentity() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return normalizeLikeEmail(user?.email) ?? readGalleryIdentity(
    (await cookies()).get(COOKIE)?.value, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getArtworkLike(slug: string) {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: unavailable }
  if (typeof slug !== 'string' || slug.length > 300) return { error: unavailable }
  try {
    const { data: artwork, error } = await createPublicClient().from('artworks').select('id').eq('slug', slug).maybeSingle()
    if (error || !artwork) return { error: unavailable }
    const email = await getIdentity()
    const admin = createAdminClient()
    const total = await admin.from('artwork_likes').select('*', { count: 'exact', head: true }).eq('artwork_id', artwork.id)
    const own = email ? await admin.from('artwork_likes').select('artwork_id').eq('artwork_id', artwork.id).eq('email', email).maybeSingle() : null
    if (total.error || own?.error) return { error: unavailable }
    return { count: total.count ?? 0, liked: Boolean(own?.data), needsEmail: !email }
  } catch {
    return { error: unavailable }
  }
}

export async function likeArtwork(slug: string, submittedEmail?: string) {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: unavailable }
  if (typeof slug !== 'string' || slug.length > 300) return { error: unavailable }
  try {
    const email = await getIdentity() ?? normalizeLikeEmail(submittedEmail)
    if (!email) return { error: 'Ingresá un mail válido para guardar tu like.', needsEmail: true }
    const { error } = await createAdminClient().rpc('like_gallery_artwork', { artwork_slug: slug, voter_email: email })
    if (error) return { error: 'No pudimos guardar tu like. Intentá de nuevo.' }
    ;(await cookies()).set(COOKIE, signGalleryIdentity(email, process.env.SUPABASE_SERVICE_ROLE_KEY), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 365 * 86400,
    })
    return { liked: true }
  } catch {
    return { error: 'No pudimos guardar tu like. Intentá de nuevo.' }
  }
}
