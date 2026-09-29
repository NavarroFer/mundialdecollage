import { describe, expect, it } from 'vitest'
import { argentinaDay, earliestScheduleDay, parseScheduleDay } from './campaign-schedule'

describe('argentinaDay', () => {
  it('is still the previous day before 03:00 UTC', () => {
    expect(argentinaDay(new Date('2026-09-30T02:59:00Z'))).toBe('2026-09-29')
    expect(argentinaDay(new Date('2026-09-30T03:00:00Z'))).toBe('2026-09-30')
  })
})

describe('earliestScheduleDay', () => {
  it('is today until 09:00 Argentina, tomorrow after', () => {
    expect(earliestScheduleDay(new Date('2026-09-29T03:00:00Z'))).toBe('2026-09-29')
    expect(earliestScheduleDay(new Date('2026-09-29T11:59:00Z'))).toBe('2026-09-29')
    expect(earliestScheduleDay(new Date('2026-09-29T12:00:00Z'))).toBe('2026-09-30')
    // 23:30 Argentina is still the 29th there.
    expect(earliestScheduleDay(new Date('2026-09-30T02:30:00Z'))).toBe('2026-09-30')
  })
})

describe('parseScheduleDay', () => {
  const now = new Date('2026-09-29T15:00:00Z')

  it('accepts today before 09:00 Argentina', () => {
    expect(parseScheduleDay('2026-09-29', new Date('2026-09-29T11:00:00Z'))).toBe('2026-09-29')
  })

  it('accepts tomorrow onwards once today\'s run is past', () => {
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
