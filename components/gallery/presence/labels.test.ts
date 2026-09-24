import { describe, expect, it } from 'vitest'
import { insideLabel, viewersLabel, waitingLabel } from './labels'

describe('gallery presence labels', () => {
  it('tells a lone visitor they are the only one inside', () => {
    expect(insideLabel(1)).toBe('Solo vos en la galería')
    // Before the visitor's own presence has synced.
    expect(insideLabel(0)).toBe('Solo vos en la galería')
  })
  it('counts everyone inside, the visitor included', () => {
    expect(insideLabel(4)).toBe('4 personas en la galería')
  })
  it('stays silent on the start screen when nobody else is inside', () => {
    expect(waitingLabel(0)).toBeNull()
  })
  it('uses singular and plural for the people already inside', () => {
    expect(waitingLabel(1)).toBe('Ahora hay 1 persona recorriendo la exposición')
    expect(waitingLabel(7)).toBe('Ahora hay 7 personas recorriendo la exposición')
  })
  it('describes who else has the same obra open', () => {
    expect(viewersLabel(0)).toBeNull()
    expect(viewersLabel(1)).toBe('Otra persona está viendo esta obra ahora')
    expect(viewersLabel(3)).toBe('3 personas más están viendo esta obra ahora')
  })
})
