import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { grantCourtesyGallery, type CourtesyInput } from './club-courtesy'

const USER = '7d2c0a4e-0000-4000-8000-000000000001'
const REFERENCE = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'

type Rpc = { data: unknown; error: { message: string } | null }

function setup(account: { user_id: string; name: string | null } | null, grant: Rpc = { data: [{ outcome: 'created', gallery_slug: 'ana-perez-7d2c0a4e' }], error: null }) {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      if (name === 'admin_club_account') return { data: account ? [account] : [], error: null }
      return grant
    },
  } as unknown as SupabaseClient
  return { db, calls }
}

const input: CourtesyInput = { email: ' Ana@Example.com ', title: '', coins: 600, reference: REFERENCE }

describe('grantCourtesyGallery', () => {
  it('looks the account up by email and creates the gallery with the profile name', async () => {
    const { db, calls } = setup({ user_id: USER, name: 'Ana Pérez' })
    const result = await grantCourtesyGallery(db, input)

    expect(result).toEqual({ ok: true, outcome: 'created', slug: 'ana-perez-7d2c0a4e' })
    expect(calls).toEqual([
      { name: 'admin_club_account', args: { p_email: 'ana@example.com' } },
      {
        name: 'grant_club_courtesy_gallery',
        args: { p_user_id: USER, p_slug: 'ana-perez-7d2c0a4e', p_title: 'Ana Pérez', p_host_avatar_id: 'Female_Adult_01', p_coins: 600, p_reference: REFERENCE },
      },
    ])
  })

  it('prefers the name typed in the form', async () => {
    const { db, calls } = setup({ user_id: USER, name: 'Ana Pérez' })
    await grantCourtesyGallery(db, { ...input, title: ' Taller de Ana ' })
    expect(calls[1].args).toMatchObject({ p_title: 'Taller de Ana', p_slug: 'taller-de-ana-7d2c0a4e' })
  })

  it('asks for a name instead of showing the email when the profile has none', async () => {
    const { db, calls } = setup({ user_id: USER, name: null })
    expect(await grantCourtesyGallery(db, input)).toEqual({ ok: false, error: 'no_name' })
    expect(calls).toHaveLength(1)
  })

  it('says when the email has no account yet', async () => {
    const { db } = setup(null)
    expect(await grantCourtesyGallery(db, input)).toEqual({ ok: false, error: 'no_account' })
  })

  it('passes on what the database did with an existing gallery', async () => {
    const { db } = setup({ user_id: USER, name: 'Ana' }, { data: [{ outcome: 'already_courtesy', gallery_slug: 'ana-viejo' }], error: null })
    expect(await grantCourtesyGallery(db, input)).toEqual({ ok: true, outcome: 'already_courtesy', slug: 'ana-viejo' })
  })

  it('leaves a paying member alone', async () => {
    const { db } = setup({ user_id: USER, name: 'Ana' }, { data: [{ outcome: 'paying', gallery_slug: 'ana' }], error: null })
    expect(await grantCourtesyGallery(db, input)).toEqual({ ok: false, error: 'paying' })
  })

  it('reports a database error as unavailable', async () => {
    const { db } = setup({ user_id: USER, name: 'Ana' }, { data: null, error: { message: 'Not authorized' } })
    expect(await grantCourtesyGallery(db, input)).toEqual({ ok: false, error: 'unavailable' })
  })

  it.each([
    { email: 'no-es-un-mail' },
    { coins: -1 },
    { coins: 1.5 },
    { coins: Number.NaN },
    { coins: 100_001 },
    { reference: 'repetible' },
  ])('refuses %o without touching the database', async (change) => {
    const { db, calls } = setup({ user_id: USER, name: 'Ana' })
    expect(await grantCourtesyGallery(db, { ...input, ...change })).toEqual({ ok: false, error: 'invalid' })
    expect(calls).toHaveLength(0)
  })
})
