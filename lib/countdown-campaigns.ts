// The countdown to the call's deadline: three campaigns (15, 7 and 1 days
// before site.deadlineISO) for the subscribed contacts who haven't taken part
// yet. The daily campaigns cron (app/api/cron/campanas) schedules each one
// itself from its system template, so it shows up in /admin/campanas as
// «programada» — cancel it there to skip it — and goes out on its day like
// any scheduled campaign. system_key keeps each one from being created twice.
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, argentinaDay } from '@/lib/campaign-schedule'
import { ensureSystemTemplate, translationsForLocales, type CountdownTemplateKey } from '@/lib/system-templates'
import { TRANSLATED_LOCALES } from '@/lib/i18n/locales'
import { site } from '@/lib/site'

const STEPS: { key: CountdownTemplateKey; daysBefore: number }[] = [
  { key: 'cuenta_regresiva_15', daysBefore: 15 },
  { key: 'cuenta_regresiva_7', daysBefore: 7 },
  { key: 'cuenta_regresiva_1', daysBefore: 1 },
]

/** Which countdown campaigns go out on which (Argentine) day. */
export function countdownSchedule(deadlineISO: string = site.deadlineISO) {
  const deadline = argentinaDay(new Date(deadlineISO))
  return STEPS.map(({ key, daysBefore }) => ({ key, day: addDays(deadline, -daysBefore) }))
}

/** Schedules the countdown campaigns still ahead (today included). */
export async function ensureCountdownCampaigns(db: SupabaseClient, today = argentinaDay()): Promise<string[]> {
  const upcoming = countdownSchedule().filter(({ day }) => day >= today)
  if (upcoming.length === 0) return []

  const { data: existing, error } = await db.from('campaigns').select('system_key').in('system_key', upcoming.map(({ key }) => key))
  if (error) throw new Error(`no se pudo revisar la cuenta regresiva: ${error.message}`)
  const done = new Set((existing ?? []).map((row) => row.system_key))

  const created: string[] = []
  for (const { key, day } of upcoming) {
    if (done.has(key)) continue
    const template = await ensureSystemTemplate(db, key)
    // Translated now, so the send itself only has to pick a language.
    const translations = await translationsForLocales(db, template, [...TRANSLATED_LOCALES])
    const { error: insertError } = await db.from('campaigns').insert({
      template_id: template.id,
      subject: template.subject,
      body_html: template.body_html,
      body_json: template.body_json,
      translations,
      status: 'scheduled',
      scheduled_for: day,
      audience: 'not_participating',
      system_key: key,
    })
    // 23505: an overlapping run created it first.
    if (insertError && insertError.code !== '23505') throw new Error(`no se pudo programar «${template.subject}»: ${insertError.message}`)
    if (!insertError) created.push(key)
  }
  return created
}
