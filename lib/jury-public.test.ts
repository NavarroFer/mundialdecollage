import { describe, expect, it } from 'vitest'
import { toPublicJuror } from './jury-public'

describe('toPublicJuror', () => {
  it('keeps only what the jury is presented with', () => {
    const juror = toPublicJuror({
      id: 'x', name: 'Ana', country_code: 'AR', job_title: 'Curadora', photo_path: null, bio_short: 'corta', bio_medium: null,
      // The RPC never returns these; if it ever did, they must not travel on.
      ...({ email: 'ana@example.com', bio_long: 'larga' } as object),
    })
    expect(juror).toEqual({ id: 'x', name: 'Ana', countryCode: 'AR', jobTitle: 'Curadora', photoPath: null, bioShort: 'corta', bioMedium: null })
  })
})
