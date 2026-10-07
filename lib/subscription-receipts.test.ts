import { describe, expect, it } from 'vitest'
import { subscriptionPickupNote } from './subscription-receipts'

describe('subscription pickup instructions', () => {
  it('explains branch pickup and waiting for arrival for Argentina', () => {
    const note = subscriptionPickupNote({ country_code: 'AR', delivery_type: 'branch' }, 'es')
    expect(note).toContain('no se entrega a domicilio')
    expect(note).toContain('confirmación de llegada')
    expect(note).toContain('acreditar su identidad')
    expect(note).toContain('fecha límite de retiro')
  })

  it('asks legacy Argentina subscribers to coordinate a branch', () => {
    const note = subscriptionPickupNote({ country_code: 'AR' }, 'es')
    expect(note).toContain('coordinar tu sucursal')
    expect(note).not.toContain('indicada arriba')
  })

  it('keeps international and unknown destinations free of branch instructions', () => {
    expect(subscriptionPickupNote({ country_code: 'US' }, 'en')).toBe('')
    expect(subscriptionPickupNote(null, 'es')).toBe('')
  })
})
