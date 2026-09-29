import { describe, expect, it } from 'vitest'
import { argentinaDay, earliestScheduleDay, parseScheduleDay } from './campaign-schedule'

describe('argentinaDay', () => {
  it('is still the previous day before 03:00 UTC', () => {
    expect(argentinaDay(new Date('2026-09-30T02:59:00Z'))).toBe('2026-09-29')
    expect(argentinaDay(new Date('2026-09-30T03:00:00Z'))).toBe('2026-09-30')
  })
})

describe('parseScheduleDay', () => {
  const now = new Date('2026-09-29T15:00:00Z')

  it('accepts tomorrow onwards in Argentina', () => {
    expect(earliestScheduleDay(now)).toBe('2026-09-30')
    expect(parseScheduleDay('2026-09-30', now)).toBe('2026-09-30')
    expect(parseScheduleDay('2026-12-31', now)).toBe('2026-12-31')
  })

  it('rejects today, past days and malformed or impossible dates', () => {
    expect(parseScheduleDay('2026-09-29', now)).toBeNull()
    expect(parseScheduleDay('2026-01-01', now)).toBeNull()
    expect(parseScheduleDay('2027-02-30', now)).toBeNull()
    expect(parseScheduleDay('30/09/2026', now)).toBeNull()
    expect(parseScheduleDay(null, now)).toBeNull()
  })
})
