import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JUROR_PROFILE_LIMITS, parseJurorProfile } from './juror-profile'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe('parseJurorProfile', () => {
  it('keeps the fields trimmed, with empty bios as null', () => {
    expect(parseJurorProfile(form({ name: ' Ana Pérez ', country_code: 'ar', job_title: ' Curadora ', bio_short: 'Artista.', bio_medium: '  ' }))).toEqual({
      profile: { name: 'Ana Pérez', country_code: 'AR', job_title: 'Curadora', bio_short: 'Artista.', bio_medium: null, bio_long: null },
    })
  })

  it('asks for a real country and a position', () => {
    expect(parseJurorProfile(form({ job_title: 'Curadora' }))).toEqual({ error: 'Elegí un país.' })
    expect(parseJurorProfile(form({ country_code: 'ZZ', job_title: 'Curadora' }))).toEqual({ error: 'Elegí un país.' })
    expect(parseJurorProfile(form({ country_code: 'AR', job_title: '   ' }))).toEqual({ error: 'Falta el cargo.' })
  })

  it('asks for the name only when required (the juror\'s own form)', () => {
    const fields = { country_code: 'AR', job_title: 'Curadora' }
    expect(parseJurorProfile(form(fields))).toMatchObject({ profile: { name: null } })
    expect(parseJurorProfile(form({ ...fields, name: ' ' }), { nameRequired: true })).toEqual({ error: 'Falta el nombre.' })
    expect(parseJurorProfile(form({ ...fields, name: 'Ana' }), { nameRequired: true })).toMatchObject({ profile: { name: 'Ana' } })
  })

  it('counts a textarea line break as one character and cuts at the limit', () => {
    const limit = JUROR_PROFILE_LIMITS.bio_short
    const result = parseJurorProfile(form({ country_code: 'AR', job_title: 'Curadora', bio_short: `${'a'.repeat(limit - 2)}\r\nb`, bio_long: 'x'.repeat(5000) }))
    expect('profile' in result && result.profile.bio_short).toBe(`${'a'.repeat(limit - 2)}\nb`)
    expect('profile' in result && result.profile.bio_long?.length).toBe(JUROR_PROFILE_LIMITS.bio_long)
  })
})

describe('JUROR_PROFILE_LIMITS', () => {
  it('matches the checks on the jurors table', () => {
    const sql = readFileSync('supabase/migrations/20261016120000_juror_profile.sql', 'utf8')
    const checked = Object.fromEntries([...sql.matchAll(/char_length\((\w+)\) <= (\d+)/g)].map(([, column, max]) => [column, Number(max)]))
    // The table doesn't check the name; only the form caps it.
    const columns = Object.fromEntries(Object.entries(JUROR_PROFILE_LIMITS).filter(([field]) => field !== 'name'))
    expect(checked).toEqual(columns)
  })
})
