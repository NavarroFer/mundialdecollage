// The countdown to the call's deadline: three campaigns (15, 7 and 1 days
// before site.deadlineISO) for the subscribed contacts who haven't taken part
// yet. Once the call is extended (site.extendedFromISO), the last day is
// cuenta_regresiva_prorroga instead: cuenta_regresiva_1 already went out for
// the first date, and its key keeps it from going out again. The daily
// campaigns cron (app/api/cron/campanas) schedules each one itself from its
// system template, so it shows up in /admin/campanas as «programada» — cancel
// it there to skip it — and goes out on its day like any scheduled campaign.
// system_key keeps each one from being created twice.
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, argentinaDay } from '@/lib/campaign-schedule'
import { ensureSystemTemplate, translationsForLocales, type CountdownTemplateKey } from '@/lib/system-templates'
import { TRANSLATED_LOCALES } from '@/lib/i18n/locales'
import { site } from '@/lib/site'
import { isCallOpen } from '@/lib/call-state'

function steps(extended: boolean): { key: CountdownTemplateKey; daysBefore: number }[] {
  return [
    { key: 'cuenta_regresiva_15', daysBefore: 15 },
    { key: 'cuenta_regresiva_7', daysBefore: 7 },
    { key: extended ? 'cuenta_regresiva_prorroga' : 'cuenta_regresiva_1', daysBefore: 1 },
  ]
}

/** Which countdown campaigns go out on which (Argentine) day. */
export function countdownSchedule(deadlineISO: string = site.deadlineISO, extended: boolean = site.extendedFromISO !== null) {
  const deadline = argentinaDay(new Date(deadlineISO))
  return steps(extended).map(({ key, daysBefore }) => ({ key, day: addDays(deadline, -daysBefore) }))
}

/** Schedules the countdown campaigns still ahead (today included). */
export async function ensureCountdownCampaigns(db: SupabaseClient, today = argentinaDay()): Promise<string[]> {
  const upcoming = countdownSchedule().filter(({ day }) => day >= today)
  // Closed early (/admin/convocatoria): nothing left to count down to.
  if (upcoming.length === 0 || !(await isCallOpen())) return []

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
