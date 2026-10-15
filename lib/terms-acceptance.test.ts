import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasAcceptedCurrentTerms, recordTermsAcceptance } from './terms-acceptance'
import { TERMS_VERSION } from './terms-version'

// The query the helpers build, and what Supabase answers.
const query = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn(), upsert: vi.fn() }
const from = vi.fn(() => query)
const supabase = { from } as unknown as SupabaseClient

beforeEach(() => {
  vi.resetAllMocks()
  from.mockImplementation(() => query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('hasAcceptedCurrentTerms', () => {
  it('looks for the person’s row for the current version', async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: 1 }, error: null })
    expect(await hasAcceptedCurrentTerms(supabase, 'user-1')).toBe(true)
    expect(from).toHaveBeenCalledWith('terms_acceptances')
    expect(query.eq).toHaveBeenCalledWith('profile_id', 'user-1')
    expect(query.eq).toHaveBeenCalledWith('terms_version', TERMS_VERSION)
  })
  it('says no when there is no row', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await hasAcceptedCurrentTerms(supabase, 'user-1')).toBe(false)
  })
  it('throws instead of guessing when Supabase fails', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'offline' } })
    await expect(hasAcceptedCurrentTerms(supabase, 'user-1')).rejects.toThrow('offline')
  })
})

describe('recordTermsAcceptance', () => {
  it('records the current version once, whatever the times it’s accepted', async () => {
    query.upsert.mockResolvedValue({ error: null })
    expect(await recordTermsAcceptance(supabase, 'user-1')).toBe(true)
    expect(query.upsert).toHaveBeenCalledWith({ profile_id: 'user-1', terms_version: TERMS_VERSION }, { onConflict: 'profile_id,terms_version', ignoreDuplicates: true })
  })
  it('reports a failed save', async () => {
    query.upsert.mockResolvedValue({ error: { message: 'denied' } })
    expect(await recordTermsAcceptance(supabase, 'user-1')).toBe(false)
  })
})
