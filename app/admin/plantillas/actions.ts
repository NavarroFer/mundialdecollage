'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createTemplate(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()

  if (!name || !subject || !bodyHtml) {
    redirect('/admin/plantillas/nueva?error=missing_fields')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('templates').insert({ name, subject, body_html: bodyHtml })

  if (error) {
    redirect(`/admin/plantillas/nueva?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/plantillas')
  redirect('/admin/plantillas')
}

export async function updateTemplate(formData: FormData) {
  const id = String(formData.get('id'))
  const name = String(formData.get('name') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()

  if (!name || !subject || !bodyHtml) {
    redirect(`/admin/plantillas/${id}?error=missing_fields`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('templates')
    .update({ name, subject, body_html: bodyHtml, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    redirect(`/admin/plantillas/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/plantillas')
  redirect('/admin/plantillas')
}

export async function deleteTemplate(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) redirect(`/admin/plantillas?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/plantillas')
}
