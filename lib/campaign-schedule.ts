// Scheduled campaigns go out once a day, when /api/cron/campanas runs (12:10
// UTC, 09:10 Argentina). Days are Argentina days (UTC-3, no DST). Today can
// still be picked until 09:00, ten minutes before the run; after that it
// would only go out tomorrow, so the earliest day becomes tomorrow.
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000
const TODAY_CUTOFF_HOUR = 9

export const SCHEDULED_SEND_TIME_LABEL = '09:10 (hora de Argentina)'

// Argentina's wall clock, read with the getUTC* methods.
const argentinaClock = (now: Date) => new Date(now.getTime() - ARGENTINA_OFFSET_MS)

// YYYY-MM-DD in Argentina.
export function argentinaDay(now: Date = new Date()): string {
  return argentinaClock(now).toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function earliestScheduleDay(now: Date = new Date()): string {
  const today = argentinaDay(now)
  return argentinaClock(now).getUTCHours() < TODAY_CUTOFF_HOUR ? today : addDays(today, 1)
}

export function parseScheduleDay(value: unknown, now: Date = new Date()): string | null {
  const day = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  // Rejects dates that don't exist (2026-02-30 would roll over).
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return null
  return day >= earliestScheduleDay(now) ? day : null
}

export function formatScheduleDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}
