export type PaypalPlanKey = 'inicial' | 'miembro' | 'socio-premium'

const planEnvironmentVariables: Record<PaypalPlanKey, 'PAYPAL_PLAN_ID_INICIAL' | 'PAYPAL_PLAN_ID_MIEMBRO' | 'PAYPAL_PLAN_ID_SOCIO_PREMIUM'> = {
  inicial: 'PAYPAL_PLAN_ID_INICIAL',
  miembro: 'PAYPAL_PLAN_ID_MIEMBRO',
  'socio-premium': 'PAYPAL_PLAN_ID_SOCIO_PREMIUM',
}

export function paypalPlanId(key: PaypalPlanKey) {
  return process.env[planEnvironmentVariables[key]]
}
