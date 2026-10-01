import { describe, expect, it } from 'vitest'
import {
  entryExternalReference,
  entryLimit,
  entryPaymentOutcome,
  needsEntryChoice,
  magazineExternalReference,
  parseExternalReference,
  resolveEntryChoice,
  subscriptionExternalReference,
} from './entries'
import { site } from './site'

describe('entryLimit', () => {
  it('lets one obra take part for free and more after paying', () => {
    expect(entryLimit(false)).toBe(1)
    expect(entryLimit(true)).toBe(site.entries.paidLimit)
  })
})

describe('needsEntryChoice', () => {
  it('asks only artists with several obras who never chose', () => {
    expect(needsEntryChoice(1, null)).toBe(false)
    expect(needsEntryChoice(3, null)).toBe(true)
    expect(needsEntryChoice(3, '2026-09-26T12:00:00Z')).toBe(false)
  })
})

describe('resolveEntryChoice', () => {
  const ownedIds = ['a', 'b', 'c']

  it('makes the single free choice the main obra', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['b'], currentMainId: 'a', limit: 1 })).toEqual({
      ok: true,
      entered: ['b'],
      main: 'b',
    })
  })

  it('refuses more obras than the limit', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['a', 'b'], limit: 1 })).toEqual({ ok: false, error: 'too_many' })
  })

  it('refuses an obra the artist does not own', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['z'], limit: 5 })).toEqual({ ok: false, error: 'not_owned' })
  })

  it('refuses an empty choice', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: [''], limit: 5 })).toEqual({ ok: false, error: 'none' })
  })

  it('ignores a repeated id instead of counting it twice', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['a', 'a'], limit: 1 })).toMatchObject({ ok: true, entered: ['a'] })
  })

  it('keeps the current main obra when it is still postulated and none was marked', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['b', 'c'], currentMainId: 'c', limit: 5 })).toMatchObject({ main: 'c' })
  })

  it('never makes a non-postulated obra the main one', () => {
    expect(
      resolveEntryChoice({ ownedIds, requestedIds: ['b', 'c'], mainId: 'a', currentMainId: 'a', limit: 5 }),
    ).toMatchObject({ main: 'b' })
  })
})

describe('external reference', () => {
  it('tells obra payments apart from the taller registrations', () => {
    expect(parseExternalReference(entryExternalReference('123'))).toEqual({ kind: 'entry', id: '123' })
    expect(parseExternalReference('9b2f-uuid')).toEqual({ kind: 'workshop', id: '9b2f-uuid' })
    expect(parseExternalReference(magazineExternalReference('abc'))).toEqual({ kind: 'magazine', id: 'abc' })
    expect(parseExternalReference('entry:')).toBeNull()
    expect(parseExternalReference('revista:')).toBeNull()
    expect(parseExternalReference(subscriptionExternalReference('s1'))).toEqual({ kind: 'subscription', id: 's1' })
    expect(parseExternalReference(null)).toBeNull()
  })
})

describe('entryPaymentOutcome', () => {
  const purchase = { status: 'pending' as const, amount: 30000, currency: 'ARS' }

  it('credits an approved payment for the full price', () => {
    expect(entryPaymentOutcome({ status: 'approved', transaction_amount: 30000, currency_id: 'ARS' }, purchase)).toBe('paid')
  })

  it('does not credit a payment for less or in another currency', () => {
    expect(entryPaymentOutcome({ status: 'approved', transaction_amount: 100, currency_id: 'ARS' }, purchase)).toBe('mismatch')
    expect(entryPaymentOutcome({ status: 'approved', transaction_amount: 30000, currency_id: 'USD' }, purchase)).toBe('mismatch')
  })

  it('keeps a paid purchase paid when a late notification says otherwise', () => {
    const paid = { ...purchase, status: 'paid' as const }
    expect(entryPaymentOutcome({ status: 'in_process' }, paid)).toBe('paid')
    expect(entryPaymentOutcome({ status: 'rejected' }, paid)).toBe('paid')
  })

  it('undoes a paid purchase only on a refund or chargeback', () => {
    const paid = { ...purchase, status: 'paid' as const }
    expect(entryPaymentOutcome({ status: 'refunded' }, paid)).toBe('refunded')
    expect(entryPaymentOutcome({ status: 'charged_back' }, paid)).toBe('refunded')
  })

  it('marks rejected payments failed and the rest pending', () => {
    expect(entryPaymentOutcome({ status: 'rejected' }, purchase)).toBe('failed')
    expect(entryPaymentOutcome({ status: 'in_process' }, purchase)).toBe('pending')
  })
})
