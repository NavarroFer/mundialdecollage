export type SupabaseMonitorResult = {
  ok: boolean
  message: string | null
}

/** Check the services the app uses on the Supabase hosted in GV Cloud. */
export async function getSelfHostedSupabaseHealth(
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<SupabaseMonitorResult> {
  const base = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !anonKey || !serviceKey) {
    return { ok: false, message: 'Faltan variables de Supabase en GV Cloud.' }
  }

  const checks = [
    { name: 'Auth', path: '/auth/v1/settings', key: anonKey },
    { name: 'PostgREST', path: '/rest/v1/artworks?select=id&limit=1', key: anonKey },
    { name: 'Storage', path: '/storage/v1/bucket', key: serviceKey },
  ]
  const failures = await Promise.all(checks.map(async ({ name, path, key }) => {
    try {
      const response = await fetcher(`${base}${path}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      })
      return response.ok ? null : `${name} respondió HTTP ${response.status}.`
    } catch {
      return `No se pudo consultar ${name}.`
    }
  }))
  const issues = failures.filter((issue): issue is string => issue !== null)
  return { ok: issues.length === 0, message: issues.length ? issues.join(' ') : null }
}

export function isR2Configured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET)
}
