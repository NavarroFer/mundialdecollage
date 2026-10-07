// Create the editable template and schedule only after the deployed sender
// supports multiple_artworks. Without --schedule this creates a draft.
import { createClient } from '@supabase/supabase-js'
import { ensureSystemTemplate } from '../lib/system-templates.ts'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const template = await ensureSystemTemplate(db, 'elegir_obra')
const { data: existing, error: lookupError } = await db.from('campaigns').select('id, status, scheduled_for').eq('system_key', 'elegir_obra_2026').maybeSingle()
if (lookupError) throw lookupError
if (existing && existing.status !== 'draft') {
  console.log(JSON.stringify({ templateId: template.id, campaign: existing, existing: true }))
} else {
  const row = {
    template_id: template.id, subject: template.subject, body_html: template.body_html,
    body_json: template.body_json, translations: template.translations ?? {},
    audience: 'multiple_artworks', system_key: 'elegir_obra_2026',
    status: process.argv.includes('--schedule') ? 'scheduled' : 'draft',
    scheduled_for: '2026-11-05',
  }
  const query = existing ? db.from('campaigns').update(row).eq('id', existing.id).eq('status', 'draft') : db.from('campaigns').insert(row)
  const { data, error } = await query.select('id, status, scheduled_for').single()
  if (error) throw error
  const { data: contacts, error: audienceError } = await db.rpc('multiple_artwork_contacts')
  if (audienceError) throw audienceError
  console.log(JSON.stringify({ templateId: template.id, campaign: data, recipientsNow: contacts.length }))
}
