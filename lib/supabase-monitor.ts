const SUPABASE_API = 'https://api.supabase.com/v1'
const DEFAULT_PROJECT_REF = 'jgneduoejygbqtwarynr'

export type SupabaseMonitorResult = {
  ok: boolean
  apiRequestCount: number | null
  message: string | null
}

type UsageResponse = {
  result?: Array<{ count?: unknown }>
  error?: unknown
}

/**
 * Checks the least-privileged Supabase endpoint available to this app. It is
 * deliberately request-volume monitoring, not billing monitoring: Supabase's
 * public Management API does not expose Storage egress totals.
 */
export async function getSupabaseApiRequestCount(
  fetcher: typeof fetch = fetch,
  token = process.env.SUPABASE_USAGE_ALERT_TOKEN,
  projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF,
): Promise<SupabaseMonitorResult> {
  if (!token) return { ok: false, apiRequestCount: null, message: 'Falta configurar SUPABASE_USAGE_ALERT_TOKEN.' }

  try {
    const response = await fetcher(
      `${SUPABASE_API}/projects/${encodeURIComponent(projectRef)}/analytics/endpoints/usage.api-requests-count`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    )
    if (!response.ok) return { ok: false, apiRequestCount: null, message: `Supabase Usage Analytics respondió HTTP ${response.status}.` }

    const payload = await response.json() as UsageResponse
    const count = payload.result?.[0]?.count
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      return { ok: false, apiRequestCount: null, message: 'Supabase Usage Analytics respondió sin un total de solicitudes válido.' }
    }
    return { ok: true, apiRequestCount: count, message: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, apiRequestCount: null, message: `No se pudo consultar Supabase Usage Analytics: ${detail}` }
  }
}

export function isR2Configured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET)
}

/** First day of the month is a reminder to review the two finished invoices. */
export function needsMonthlyPlanReview(now = new Date()) {
  return now.getUTCDate() === 1
}

export function proPlanReviewText() {
  return [
    'Plan Pro: no bajar automáticamente.',
    'Revisar las dos facturas mensuales ya cerradas en Supabase.',
    'Recién conviene evaluar volver a Free si ambas quedaron por debajo del 20% de egress incluido y no se usan funciones pagas necesarias.',
    'El contador automático mide solicitudes, no egress: Supabase no publica ese total en su Management API de solo lectura.',
  ].join('\n')
}
