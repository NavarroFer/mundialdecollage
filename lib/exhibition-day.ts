// The exhibition day starts at 09:00 in Argentina (UTC-3, no DST), i.e.
// 12:00 UTC — so the obras change in the morning, not at 21:00 local.
// Keep in sync with exhibition_day() in
// supabase/migrations/20260925120000_exhibition_days.sql.
const ROTATION_OFFSET_MS = 12 * 60 * 60 * 1000

/** The exhibition day (YYYY-MM-DD) a moment falls in. */
export function exhibitionDay(date = new Date()): string {
  return new Date(date.getTime() - ROTATION_OFFSET_MS).toISOString().slice(0, 10)
}
