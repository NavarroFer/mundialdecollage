'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// The block editor submits body_json alongside body_html (its rendered
// output) — parsed here into an object so Postgrest stores it as jsonb
// instead of a doubly-encoded string. Templates still on the legacy raw-HTML
// textarea don't send this field at all, so it stays null for them.
function parseBodyJson(formData: FormData) {
  const raw = formData.get('body_json')
  if (!raw) return null
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

export async function createTemplate(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()
  const bodyJson = parseBodyJson(formData)

  if (!name || !subject || !bodyHtml) {
    redirect('/admin/plantillas/nueva?error=missing_fields')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('templates').insert({ name, subject, body_html: bodyHtml, body_json: bodyJson })

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
  const bodyJson = parseBodyJson(formData)

  if (!name || !subject || !bodyHtml) {
    redirect(`/admin/plantillas/${id}?error=missing_fields`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('templates')
    .update({ name, subject, body_html: bodyHtml, body_json: bodyJson, updated_at: new Date().toISOString() })
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

// Clones a template as a starting point for a new one — "Creemos una de base
// y que se pueda duplicar para otras": one canonical layout, duplicated
// instead of rebuilt from scratch for each new send.
export async function duplicateTemplate(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { data: original, error: fetchError } = await supabase
    .from('templates')
    .select('name, subject, body_html, body_json')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !original) {
    redirect(`/admin/plantillas?error=${encodeURIComponent(fetchError?.message ?? 'No se encontró la plantilla')}`)
  }

  const { data: copy, error: insertError } = await supabase
    .from('templates')
    .insert({
      name: `${original.name} (copia)`,
      subject: original.subject,
      body_html: original.body_html,
      body_json: original.body_json,
    })
    .select('id')
    .single()

  if (insertError || !copy) {
    redirect(`/admin/plantillas?error=${encodeURIComponent(insertError?.message ?? 'No se pudo duplicar')}`)
  }

  revalidatePath('/admin/plantillas')
  redirect(`/admin/plantillas/${copy.id}`)
}
