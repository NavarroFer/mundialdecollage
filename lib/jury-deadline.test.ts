import { describe, expect, it } from 'vitest'
import { formatJuryDeadline, isReminderDay, isVotingClosed, jurorsToRemind, type ReminderJuror } from './jury-deadline'

const DEADLINE = '2026-11-30T23:59:59-03:00'

describe('isVotingClosed', () => {
  it('is never closed without a deadline', () => {
    expect(isVotingClosed(null, new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })

  it('closes right after the deadline', () => {
    expect(isVotingClosed(DEADLINE, new Date('2026-11-30T23:59:00-03:00'))).toBe(false)
    expect(isVotingClosed(DEADLINE, new Date('2026-12-01T00:00:00-03:00'))).toBe(true)
  })
})

describe('formatJuryDeadline', () => {
  it('formats the day and time in Argentina', () => {
    expect(formatJuryDeadline(DEADLINE)).toBe('lunes 30 de noviembre a las 23:59 (hora de Argentina)')
  })

  it('is null without a deadline', () => {
    expect(formatJuryDeadline(null)).toBeNull()
  })
})

describe('isReminderDay', () => {
  it('is 3 and 1 days before the deadline, Argentina days', () => {
    expect(isReminderDay(DEADLINE, '2026-11-27')).toBe(true)
    expect(isReminderDay(DEADLINE, '2026-11-29')).toBe(true)
    expect(isReminderDay(DEADLINE, '2026-11-28')).toBe(false)
    expect(isReminderDay(DEADLINE, '2026-11-30')).toBe(false)
  })

  it('uses the deadline day in Argentina, not UTC', () => {
    // 01:00 UTC on Dec 1st is still Nov 30th in Argentina.
    expect(isReminderDay('2026-12-01T01:00:00Z', '2026-11-29')).toBe(true)
  })

  it('never fires without a deadline', () => {
    expect(isReminderDay(null, '2026-11-29')).toBe(false)
  })
})

describe('jurorsToRemind', () => {
  const juror = (id: string, extra: Partial<ReminderJuror> = {}): ReminderJuror =>
    ({ id, email: `${id}@x.com`, name: null, active: true, reminded_on: null, ...extra })

  it('picks active jurors with unscored obras of the pool, not reminded today', () => {
    const result = jurorsToRemind(
      [juror('done'), juror('half'), juror('none'), juror('off', { active: false }), juror('today', { reminded_on: '2026-11-29' }), juror('yesterday', { reminded_on: '2026-11-27' })],
      [
        { juror_id: 'done', item_key: 'a' },
        { juror_id: 'done', item_key: 'b' },
        { juror_id: 'half', item_key: 'a' },
        // An obra no longer in the pool doesn't count.
        { juror_id: 'half', item_key: 'old' },
      ],
      ['a', 'b'],
      '2026-11-29',
    )
    expect(result.map(({ juror, missing }) => [juror.id, missing])).toEqual([
      ['half', 1],
      ['none', 2],
      ['yesterday', 2],
    ])
  })

  it('reminds nobody while the pool is empty', () => {
    expect(jurorsToRemind([juror('a')], [], [], '2026-11-29')).toEqual([])
  })
})
