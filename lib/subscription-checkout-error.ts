// Persist only diagnostic fields; provider responses can contain personal data.
export function subscriptionCheckoutError(stage: string, error: unknown, sensitiveValues: string[] = []) {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const redact = (value: unknown) => typeof value === 'string'
    ? sensitiveValues.reduce((text, secret) => secret ? text.split(secret).join('[redacted]') : text, value).replace(/(?:APP_USR|TEST)-[\w-]+/g, '[credential]').replace(/Bearer\s+\S+/gi, '[credential]').replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[email]').replace(/\b\d{12,19}\b/g, '[number]').slice(0, 500)
    : undefined
  return {
    stage,
    at: new Date().toISOString(),
    status: typeof source.status === 'number' ? source.status : undefined,
    message: redact(source.message) ?? 'Unknown checkout error',
    codes: Array.isArray(source.cause ?? source.causes) ? ((source.cause ?? source.causes) as unknown[]).slice(0, 10).flatMap((cause) => {
      if (!cause || typeof cause !== 'object') return []
      const code = (cause as Record<string, unknown>).code
      return typeof code === 'number' || typeof code === 'string' ? [redact(String(code))!.slice(0, 80)] : []
    }) : [],
  }
}
