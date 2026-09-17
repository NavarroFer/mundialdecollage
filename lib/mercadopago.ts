import { MercadoPagoConfig } from 'mercadopago'

// Same pattern as isSupabaseConfigured / isResendConfigured: everything
// checks this first so the site renders (in a disabled state) before real
// credentials exist.
export const isMercadoPagoConfigured = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)

// Only call after checking isMercadoPagoConfigured.
export function getMercadoPagoConfig() {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })
}
