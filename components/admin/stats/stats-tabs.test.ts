import { describe, expect, it } from 'vitest'
import { tabAfterKey } from './stats-tabs'

const ids = ['convocatoria', 'galeria', 'difusion']

describe('tabAfterKey', () => {
  it('moves along the tabs with the arrows, wrapping at the ends', () => {
    expect(tabAfterKey(ids, 'galeria', 'ArrowRight')).toBe('difusion')
    expect(tabAfterKey(ids, 'difusion', 'ArrowRight')).toBe('convocatoria')
    expect(tabAfterKey(ids, 'convocatoria', 'ArrowLeft')).toBe('difusion')
  })

  it('jumps to the first and last tab with Home and End', () => {
    expect(tabAfterKey(ids, 'galeria', 'Home')).toBe('convocatoria')
    expect(tabAfterKey(ids, 'galeria', 'End')).toBe('difusion')
  })

  it('leaves every other key alone', () => {
    expect(tabAfterKey(ids, 'galeria', 'Enter')).toBeNull()
  })
})
