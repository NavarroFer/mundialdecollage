import { describe, expect, it } from 'vitest'
import { subscriptionCheckoutError } from './subscription-checkout-error'

describe('subscriptionCheckoutError', () => {
  it('captures SDK errors without persisting the full provider response', () => {
    const result = subscriptionCheckoutError('create_preapproval', {
      status: 400, message: 'Invalid users involved', cause: [{ code: 2034, description: 'Private details' }],
      payer_email: 'private@example.com', authorization: 'secret',
    })
    expect(result).toMatchObject({ stage: 'create_preapproval', status: 400, message: 'Invalid users involved', codes: ['2034'] })
    expect(JSON.stringify(result)).not.toMatch(/Private details|private@example|secret/)
  })
  it('redacts emails and credentials in messages', () => {
    expect(subscriptionCheckoutError('save_preapproval', new Error('user@example.com APP_USR-123-secret TEST-456-secret')).message)
      .toBe('[email] [credential] [credential]')
  })
  it('handles unexpected errors and bounds stored messages', () => {
    expect(subscriptionCheckoutError('checkout_url', null).message).toBe('Unknown checkout error')
    expect(subscriptionCheckoutError('checkout_url', new Error('x'.repeat(1000))).message).toHaveLength(500)
  })
})

it('preserves codes when a sanitized diagnostic is recorded again', () => {
  const diagnostic = subscriptionCheckoutError('create_preapproval', { status: 400, message: 'Invalid private-token', causes: [{ code: 'CC_VAL_433' }] }, ['private-token'])
  expect(subscriptionCheckoutError('create_preapproval', diagnostic)).toMatchObject({ message: 'Invalid [redacted]', status: 400, codes: ['CC_VAL_433'] })
})
