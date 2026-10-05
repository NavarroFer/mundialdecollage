import { describe, expect, it } from 'vitest'
import {
  entryExternalReference,
  magazineExternalReference,
  parseExternalReference,
  subscriptionExternalReference,
  workshopExternalReference,
} from './references'

describe('external reference', () => {
  it('tells obra payments apart from the taller registrations', () => {
    expect(parseExternalReference(entryExternalReference('123'))).toEqual({ kind: 'entry', id: '123' })
    expect(parseExternalReference(workshopExternalReference('9b2f-uuid'))).toEqual({ kind: 'workshop', id: '9b2f-uuid' })
    expect(parseExternalReference(magazineExternalReference('abc'))).toEqual({ kind: 'magazine', id: 'abc' })
    expect(parseExternalReference('entry:')).toBeNull()
    expect(parseExternalReference('revista:')).toBeNull()
    expect(parseExternalReference(subscriptionExternalReference('s1'))).toEqual({ kind: 'subscription', id: 's1' })
    expect(parseExternalReference(null)).toBeNull()
  })
})
