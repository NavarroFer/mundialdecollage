import { describe, expect, it } from 'vitest'
import { countdownSchedule } from './countdown-campaigns'

describe('countdownSchedule', () => {
  it('counts back from the deadline day in Argentina', () => {
    expect(countdownSchedule('2026-11-15T23:59:59-03:00', false)).toEqual([
      { key: 'cuenta_regresiva_15', day: '2026-10-31' },
      { key: 'cuenta_regresiva_7', day: '2026-11-08' },
      { key: 'cuenta_regresiva_1', day: '2026-11-14' },
    ])
  })

  it('gives an extended call its own last-day reminder', () => {
    expect(countdownSchedule('2026-11-20T23:59:59-03:00', true)).toEqual([
      { key: 'cuenta_regresiva_15', day: '2026-11-05' },
      { key: 'cuenta_regresiva_7', day: '2026-11-13' },
      { key: 'cuenta_regresiva_prorroga', day: '2026-11-19' },
    ])
  })
})
