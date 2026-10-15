import { describe, expect, it } from 'vitest'
import { DEAD_ZONE, FULL_TURN, edgeTurn } from './edgeTurn'

const across = (offset: number) => (offset + 1) / 2

describe('edgeTurn', () => {
  it('holds still around the middle, so a click can aim', () => {
    expect(edgeTurn(0.5)).toBe(0)
    expect(edgeTurn(across(DEAD_ZONE))).toBe(0)
    expect(edgeTurn(across(-DEAD_ZONE))).toBe(0)
  })

  it('turns towards the side the cursor is on', () => {
    expect(edgeTurn(0.85)).toBeGreaterThan(0)
    expect(edgeTurn(0.15)).toBeLessThan(0)
    expect(edgeTurn(0.15)).toBeCloseTo(-edgeTurn(0.85))
  })

  it('eases in, and turns at full speed near the edge and past it', () => {
    const halfway = across((DEAD_ZONE + FULL_TURN) / 2)
    expect(edgeTurn(halfway)).toBeCloseTo(0.25)
    expect(edgeTurn(across(FULL_TURN))).toBeCloseTo(1)
    expect(edgeTurn(1)).toBe(1)
    expect(edgeTurn(0)).toBe(-1)
    expect(edgeTurn(1.2)).toBe(1)
  })
})
