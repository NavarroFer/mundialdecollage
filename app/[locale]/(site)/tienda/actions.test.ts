import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), redirect: vi.fn(), track: vi.fn(), record: vi.fn(), sync: vi.fn(), resolve: vi.fn(), quote: vi.fn() }))
vi.mock('@/lib/correo', () => ({ resolvePickup: mocks.resolve, quoteSubscriptionShipping: mocks.quote }))
vi.mock('@/lib/customer-payment-errors', () => ({ recordCustomerPaymentError: mocks.record }))
vi.mock('@/lib/mp-subscriptions', () => ({ syncPreapprovalById: mocks.sync }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('mercadopago', () => ({ PreApproval: class { create = mocks.create } }))
vi.mock('@/lib/mercadopago', () => ({ isMercadoPagoConfigured: true, getMercadoPagoConfig: () => ({}) }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/payments/customers', () => ({ upsertCustomer: async () => 'customer' }))
vi.mock('@/lib/track-server', () => ({ trackServer: mocks.track }))
vi.mock('@/lib/magazine', () => ({ MAGAZINE_FIELDS: [], parseMagazineOrder: () => ({ ok: true, order: { email: 'buyer@example.com', name: 'Buyer', phone: '123', shipping: { city: 'City', province: 'Province', postal_code: '1234', address_line_1: 'Street' } } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({
  insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'subscription' }, error: null }) }) }),
  update: mocks.update,
}) }) }))
import { startMpSubscription } from './actions'

function checkoutForm() { const form = new FormData(); form.set('branch_code', 'B0107'); form.set('province', 'Buenos Aires'); form.set('shipping_fee', '4200'); return form }

const initial = { error: null, invalid: [], values: {} }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test')
  vi.stubEnv('NEXT_PUBLIC_MP_PUBLIC_KEY', 'public-key')
  mocks.resolve.mockResolvedValue({ code: 'B0107', name: 'Monte Grande', address: 'Vicente López 448', city: 'Esteban Echeverría', locality: 'Monte Grande', postalCode: '1842' })
  mocks.quote.mockResolvedValue(4200)
  mocks.sync.mockResolvedValue('active')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.update.mockImplementation(() => ({ eq: async () => ({ error: null }) }))
})
describe('subscription checkout', () => {
  it('persists a rejected provider request and returns a recoverable error', async () => {
    mocks.create.mockRejectedValue({ status: 400, message: 'Invalid users involved' })
    expect(await startMpSubscription('inicial', initial, checkoutForm())).toMatchObject({ error: 'unavailable' })
    expect(mocks.update).toHaveBeenCalledWith({ checkout_error: expect.objectContaining({ stage: 'create_preapproval', status: 400 }) })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it('does not redirect when saving the provider ID fails', async () => {
    mocks.create.mockResolvedValue({ id: 'mp-id', init_point: 'https://checkout.example.com' })
    mocks.update.mockImplementationOnce(() => ({ eq: async () => ({ error: { message: 'Database unavailable' } }) }))
    await startMpSubscription('inicial', initial, checkoutForm())
    expect(mocks.update).toHaveBeenLastCalledWith({ checkout_error: expect.objectContaining({ stage: 'save_preapproval' }) })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it('records a missing checkout URL after retaining the provider ID', async () => {
    mocks.create.mockResolvedValue({ id: 'mp-id' })
    await startMpSubscription('inicial', initial, checkoutForm())
    expect(mocks.update).toHaveBeenCalledWith({ provider_subscription_id: 'mp-id' })
    expect(mocks.update).toHaveBeenLastCalledWith({ checkout_error: expect.objectContaining({ stage: 'checkout_url' }) })
  })
  it('redirects after creating and saving a valid checkout', async () => {
    mocks.create.mockResolvedValue({ id: 'mp-id', init_point: 'https://checkout.example.com' })
    await startMpSubscription('inicial', initial, checkoutForm())
    expect(mocks.redirect).toHaveBeenCalledWith('https://checkout.example.com')
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
  it('still returns the original error when persisting diagnostics fails', async () => {
    mocks.create.mockRejectedValue(new Error('Provider unavailable'))
    mocks.update.mockImplementation(() => ({ eq: async () => { throw new Error('Database unavailable') } }))
    expect(await startMpSubscription('inicial', initial, checkoutForm())).toMatchObject({ error: 'unavailable' })
  })
})

describe('card subscriptions', () => {
  const card = () => { const form = checkoutForm(); form.set('payment_method', 'card'); form.set('card_token', 'private-card-token'); form.set('payer_email', 'cardpayer@example.com'); form.set('amount', '1'); return form }
  it('uses the tokenized payer and server price, then synchronizes authorization', async () => {
    mocks.create.mockResolvedValue({ id: 'mp-card', status: 'authorized' })
    expect(await startMpSubscription('inicial', initial, card())).toMatchObject({ subscription: { id: 'mp-card', status: 'active' } })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ payer_email: 'cardpayer@example.com', card_token_id: 'private-card-token', status: 'authorized', auto_recurring: expect.objectContaining({ transaction_amount: 19200 }) }), requestOptions: { idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/) } }))
    expect(mocks.sync).toHaveBeenCalledWith('mp-card')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it('does not send incomplete card requests', async () => {
    const form = card(); form.delete('card_token')
    expect(await startMpSubscription('inicial', initial, form)).toMatchObject({ error: 'unavailable' })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('records a safe failure without the card token and gives a useful error', async () => {
    mocks.create.mockRejectedValue({ status: 400, message: 'Insufficient funds private-card-token' })
    expect(await startMpSubscription('inicial', initial, card())).toMatchObject({ paymentError: 'funds' })
    expect(JSON.stringify(mocks.record.mock.calls)).not.toContain('private-card-token')
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer', subscriptionId: 'subscription', stage: 'create_preapproval' }))
  })
  it('does not claim active when synchronization has not confirmed it', async () => {
    mocks.create.mockResolvedValue({ id: 'mp-card', status: 'pending' }); mocks.sync.mockResolvedValue(null)
    expect(await startMpSubscription('inicial', initial, card())).toMatchObject({ subscription: { status: 'pending' } })
  })
  it('reconciles an authorized card when saving its ID fails, instead of encouraging a duplicate payment', async () => {
    mocks.create.mockResolvedValue({ id: 'mp-card', status: 'authorized' })
    mocks.update.mockImplementationOnce(() => ({ eq: async () => ({ error: { message: 'Database unavailable' } }) }))
    expect(await startMpSubscription('inicial', initial, card())).toMatchObject({ subscription: { id: 'mp-card', status: 'active' } })
    expect(mocks.sync).toHaveBeenCalledWith('mp-card')
  })

})


describe('branch and tariff validation', () => {
  it('rejects missing or unavailable branches before creating any provider payment', async () => {
    const form = checkoutForm(); form.delete('branch_code')
    expect(await startMpSubscription('inicial', initial, form)).toMatchObject({ invalid: ['branch_code'] })
    mocks.resolve.mockResolvedValue(null)
    expect(await startMpSubscription('inicial', initial, checkoutForm())).toMatchObject({ invalid: ['branch_code'] })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('requires a new review if the shipping amount was altered or changed', async () => {
    const form = checkoutForm(); form.set('shipping_fee', '1')
    expect(await startMpSubscription('inicial', initial, form)).toMatchObject({ invalid: ['shipping_fee'] })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('never starts billing when Correo cannot quote', async () => {
    mocks.quote.mockRejectedValue(new Error('Timeout'))
    expect(await startMpSubscription('inicial', initial, checkoutForm())).toMatchObject({ error: 'unavailable' })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
