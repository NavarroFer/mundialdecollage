// The jury's voting deadline (site.jury.deadlineISO) and who gets reminded
// before it. Pure, so /jurado, its server action, the admin and the cron all
// agree on when voting closes. Days are Argentina days, like the campaigns.
import { addDays, argentinaDay } from '@/lib/campaign-schedule'

/** True once the deadline is set and has passed. No deadline: never closed. */
export function isVotingClosed(deadlineISO: string | null, now: Date = new Date()): boolean {
  if (!deadlineISO) return false
  const deadline = Date.parse(deadlineISO)
  return Number.isFinite(deadline) && now.getTime() > deadline
}

/** «lunes 30 de noviembre a las 23:59 (hora de Argentina)», or null without a deadline. */
export function formatJuryDeadline(deadlineISO: string | null): string | null {
  if (!deadlineISO) return null
  const date = new Date(deadlineISO)
  if (Number.isNaN(date.getTime())) return null
  const timeZone = 'America/Argentina/Buenos_Aires'
  const day = date.toLocaleDateString('es-AR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')
  const time = date.toLocaleTimeString('es-AR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} a las ${time} (hora de Argentina)`
}

// Reminders go out this many days before the deadline's (Argentina) day.
export const REMINDER_DAYS_BEFORE = [3, 1] as const

/** Whether `today` (YYYY-MM-DD, Argentina) is a reminder day for this deadline. */
export function isReminderDay(deadlineISO: string | null, today: string): boolean {
  if (!deadlineISO) return false
  const deadline = new Date(deadlineISO)
  if (Number.isNaN(deadline.getTime())) return false
  const deadlineDay = argentinaDay(deadline)
  return REMINDER_DAYS_BEFORE.some((days) => addDays(deadlineDay, -days) === today)
}

export type ReminderJuror = { id: string; email: string; name: string | null; active: boolean; reminded_on: string | null }

/**
 * Active jurors who still have obras of the current pool to score and
 * weren't reminded today yet, with how many they're missing.
 */
export function jurorsToRemind(
  jurors: ReminderJuror[],
  scores: { juror_id: string; item_key: string }[],
  poolKeys: string[],
  today: string,
): { juror: ReminderJuror; missing: number }[] {
  if (poolKeys.length === 0) return []
  const pool = new Set(poolKeys)
  const scored = new Map<string, number>()
  for (const score of scores) {
    if (pool.has(score.item_key)) scored.set(score.juror_id, (scored.get(score.juror_id) ?? 0) + 1)
  }
  return jurors
    .filter((juror) => juror.active && juror.reminded_on !== today)
    .map((juror) => ({ juror, missing: pool.size - (scored.get(juror.id) ?? 0) }))
    .filter(({ missing }) => missing > 0)
}
