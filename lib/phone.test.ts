import { describe, expect, it } from 'vitest'
import { argentineMobile } from './phone'

describe('argentineMobile', () => {
  it.each([
    ['11 2345-6789', '+54 9 1123456789'],
    ['011 15 2345-6789', '+54 9 1123456789'],
    ['+54 9 11 2345 6789', '+54 9 1123456789'],
    ['+54 11 2345 6789', '+54 9 1123456789'],
    ['(223) 15 412-3456', '+54 9 2234123456'],
    ['0223 412 3456', '+54 9 2234123456'],
    ['+54 9 2266 15 41 2345', '+54 9 2266412345'],
    ['3415551234', '+54 9 3415551234'],
  ])('reads %s', (raw, expected) => {
    expect(argentineMobile(raw)).toBe(expected)
  })

  it.each(['12', '15 2345 6789', '2345 6789', '11 2345 678', '11 2345 67890', '+1 415 555 1234', '11-2345-abcd', '4123456789'])('rejects %s', (raw) => {
    expect(argentineMobile(raw)).toBeNull()
  })
})
