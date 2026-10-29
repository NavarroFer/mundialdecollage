export type PaypalPlanKey = 'inicial' | 'miembro' | 'socio-premium' | 'club-monthly' | 'club-annual'

const planEnvironmentVariables = {
  inicial: 'PAYPAL_PLAN_ID_INICIAL',
  miembro: 'PAYPAL_PLAN_ID_MIEMBRO',
  'socio-premium': 'PAYPAL_PLAN_ID_SOCIO_PREMIUM',
  'club-monthly': 'PAYPAL_PLAN_ID_CLUB_MONTHLY',
  'club-annual': 'PAYPAL_PLAN_ID_CLUB_ANNUAL',
} as const satisfies Record<PaypalPlanKey, string>

export function paypalPlanId(key: PaypalPlanKey) {
  return process.env[planEnvironmentVariables[key]]
}
