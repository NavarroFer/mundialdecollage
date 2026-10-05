'use server'

import { revalidatePath } from 'next/cache'
import { parseAudiences } from '@/lib/template-audiences'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isEmailDocument } from '@/lib/email-blocks'
import { emailTextsFingerprint, extractEmailTexts, type EmailTranslations } from '@/lib/email-translation'
import { isTranslatorConfigured, translateEmailTexts } from '@/lib/email-translator'

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

// Translates a template's texts into every other language — a block-based
// one, that is: legacy raw-HTML templates stay Spanish-only. Never throws,
// so a translation problem can't lose the template itself; the languages
// that failed come back in `errors` for the admin instead.
async function translateForTemplate(subject: string, bodyJson: unknown): Promise<{
  translations: EmailTranslations
  translations_source: string | null
  errors: string[]
}> {
  if (!isEmailDocument(bodyJson) || !isTranslatorConfigured) {
    return { translations: {}, translations_source: null, errors: [] }
  }
  try {
    const { translations, errors } = await translateEmailTexts(extractEmailTexts(subject, bodyJson))
    return { translations, translations_source: emailTextsFingerprint(subject, bodyJson), errors }
  } catch (error) {
    return { translations: {}, translations_source: null, errors: [error instanceof Error ? error.message : String(error)] }
  }
}

function listUrl(errors: string[], prefix = 'La plantilla se guardó, pero no se pudo traducir') {
  if (!errors.length) return '/admin/plantillas'
  return `/admin/plantillas?error=${encodeURIComponent(`${prefix}: ${errors.join('; ')}`)}`
}

export async function createTemplate(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()
  const bodyJson = parseBodyJson(formData)

  if (!name || !subject || !bodyHtml) {
    redirect('/admin/plantillas/nueva?error=missing_fields')
  }

  const { errors, ...translated } = await translateForTemplate(subject, bodyJson)
  const supabase = await createClient()
  const { error } = await supabase
    .from('templates')
    .insert({ name, subject, body_html: bodyHtml, body_json: bodyJson, audiences: parseAudiences(formData.getAll('audiences')), ...translated })

  if (error) {
    redirect(`/admin/plantillas/nueva?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/plantillas')
  redirect(listUrl(errors))
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
  const { data: current } = await supabase.from('templates').select('translations_source').eq('id', id).maybeSingle()

  // Only a change in wording needs new translations; moving blocks around,
  // swapping an image or fixing a link keeps the existing ones valid.
  const wordingUnchanged =
    isEmailDocument(bodyJson) && current?.translations_source === emailTextsFingerprint(subject, bodyJson)
  const { errors, ...translated } = wordingUnchanged
    ? { errors: [] }
    : await translateForTemplate(subject, bodyJson)

  const { error } = await supabase
    .from('templates')
    .update({ name, subject, body_html: bodyHtml, body_json: bodyJson, audiences: parseAudiences(formData.getAll('audiences')), ...translated, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    redirect(`/admin/plantillas/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/plantillas')
  redirect(listUrl(errors))
}

// The "Traducir" button in the list: (re)translates a template as it stands,
// e.g. one saved before the translator was connected.
export async function translateTemplate(formData: FormData) {
  const id = String(formData.get('id'))
  const supabase = await createClient()
  const { data: template } = await supabase.from('templates').select('subject, body_json').eq('id', id).maybeSingle()
  if (!template) redirect(`/admin/plantillas?error=${encodeURIComponent('No se encontró la plantilla')}`)
  if (!isEmailDocument(template.body_json)) {
    redirect(`/admin/plantillas?error=${encodeURIComponent('Las plantillas hechas en HTML no se pueden traducir; recreala con el editor de bloques.')}`)
  }
  if (!isTranslatorConfigured) {
    redirect(`/admin/plantillas?error=${encodeURIComponent('Falta configurar ANTHROPIC_API_KEY para traducir.')}`)
  }

  const { errors, ...translated } = await translateForTemplate(template.subject, template.body_json)
  const { error } = await supabase.from('templates').update(translated).eq('id', id)
  if (error) redirect(`/admin/plantillas?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/plantillas')
  redirect(listUrl(errors, 'Algunos idiomas quedaron sin traducir'))
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
    .select('name, subject, body_html, body_json, translations, translations_source, audiences')
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
      translations: original.translations,
      translations_source: original.translations_source,
      audiences: original.audiences ?? [],
    })
    .select('id')
    .single()

  if (insertError || !copy) {
    redirect(`/admin/plantillas?error=${encodeURIComponent(insertError?.message ?? 'No se pudo duplicar')}`)
  }

  revalidatePath('/admin/plantillas')
  redirect(`/admin/plantillas/${copy.id}`)
}
