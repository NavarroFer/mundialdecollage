import { describe, expect, it, vi } from 'vitest'
import { getSupabaseApiRequestCount, isR2Configured, needsMonthlyPlanReview, proPlanReviewText } from './supabase-monitor'

describe('Supabase monitoring', () => {
  it('reads the request count through the scoped analytics endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [{ count: 42 }] }), { status: 200 }))
    await expect(getSupabaseApiRequestCount(fetcher, 'scoped-token', 'project-ref')).resolves.toEqual({ ok: true, apiRequestCount: 42, message: null })
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.supabase.com/v1/projects/project-ref/analytics/endpoints/usage.api-requests-count',
      expect.objectContaining({ headers: { Authorization: 'Bearer scoped-token' } }),
    )
  })

  it('does not claim a successful check when the API rejects it', async () => {
    await expect(getSupabaseApiRequestCount(vi.fn().mockResolvedValue(new Response(null, { status: 402 })), 'token')).resolves.toMatchObject({ ok: false, message: 'Supabase Usage Analytics respondió HTTP 402.' })
  })

  it('only considers a complete R2 configuration healthy', () => {
    expect(isR2Configured({ R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_BUCKET: 'd' })).toBe(true)
    expect(isR2Configured({ R2_ACCOUNT_ID: 'a' })).toBe(false)
  })

  it('asks for a plan review only on the first day of the month', () => {
    expect(needsMonthlyPlanReview(new Date('2026-11-01T12:00:00Z'))).toBe(true)
    expect(needsMonthlyPlanReview(new Date('2026-11-02T12:00:00Z'))).toBe(false)
    expect(proPlanReviewText()).toContain('20%')
  })
})
