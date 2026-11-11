'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ADMIN_EMAILS } from '@/lib/admin'
import { POST_BODY_MAX, POSTS_BUCKET, cleanBody, isUuid } from '@/lib/community'
import { hasImageSignature } from '@/lib/image-signature'

// Admin writes for Comunidad. The email is the permission, same as the other
// admin actions: the service role bypasses RLS, so the check has to live here.

async function assertAdmin() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) redirect('/admin/publicaciones?error=sin+permiso')
  return user
}

function imageKind(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (!hasImageSignature(bytes)) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  if (bytes[0] === 0x89) return 'png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'webp'
  return null
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

export async function publishOfficial(formData: FormData) {
  const user = await assertAdmin()
  const body = cleanBody(formData.get('body'), POST_BODY_MAX)
  if (body == null) redirect('/admin/publicaciones?error=El+texto+es+muy+largo')
  const file = formData.get('image')
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024) {
    redirect('/admin/publicaciones?error=La+imagen+tiene+que+ser+JPG%2C+PNG+o+WebP+de+hasta+3+MB')
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = imageKind(bytes)
  if (!kind) redirect('/admin/publicaciones?error=El+archivo+no+es+una+imagen')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) {
    // The visibility trigger publishes a brand-new profile. The card does not
    // use that name: official posts are shown as «Mundial de Collage».
    const { error } = await admin.from('profiles').insert({ id: user.id, name: 'Mundial de Collage' })
    if (error) redirect(`/admin/publicaciones?error=${encodeURIComponent(error.message)}`)
  }

  const path = `${user.id}/${crypto.randomUUID()}.${kind}`
  const uploaded = await admin.storage.from(POSTS_BUCKET).upload(path, bytes, { contentType: MIME[kind], upsert: false })
  if (uploaded.error) redirect(`/admin/publicaciones?error=${encodeURIComponent(uploaded.error.message)}`)

  const until = String(formData.get('until') ?? '')
  const pin = formData.get('pin') === 'on' && /^\d{4}-\d{2}-\d{2}$/.test(until)
  const { error } = await admin.from('posts').insert({
    profile_id: user.id,
    kind: 'photo',
    image_path: path,
    body,
    status: 'published',
    official: true,
    pinned_until: pin ? new Date(`${until}T23:59:59-03:00`).toISOString() : null,
  })
  if (error) {
    await admin.storage.from(POSTS_BUCKET).remove([path])
    redirect(`/admin/publicaciones?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/admin/publicaciones')
  redirect('/admin/publicaciones?tab=publicadas')
}

export async function moderatePost(formData: FormData) {
  await assertAdmin()
  const id = String(formData.get('id') ?? '')
  const action = String(formData.get('action') ?? '')
  const tab = String(formData.get('tab') ?? 'publicadas')
  if (!isUuid(id) || !['publish', 'hide', 'remove'].includes(action)) redirect('/admin/publicaciones?error=No+se+pudo')

  const admin = createAdminClient()
  const { data } = await admin.from('posts').select('image_path').eq('id', id).maybeSingle()
  const patch = action === 'publish'
    ? { status: 'published', report_count: 0, moderated_at: new Date().toISOString() }
    : { status: action === 'hide' ? 'hidden' : 'removed', moderated_at: new Date().toISOString() }
  const { error } = await admin.from('posts').update(patch).eq('id', id)
  if (error) redirect(`/admin/publicaciones?tab=${tab}&error=${encodeURIComponent(error.message)}`)
  if (action === 'remove' && data?.image_path) await admin.storage.from(POSTS_BUCKET).remove([data.image_path])
  revalidatePath('/admin/publicaciones')
  redirect(`/admin/publicaciones?tab=${tab}`)
}
