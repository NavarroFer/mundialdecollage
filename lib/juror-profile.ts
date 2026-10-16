import { COUNTRY_CODES } from '@/lib/country-codes'

// What /admin/jurado records about a juror besides the email they sign in
// with: name, country, position and the bio in up to three lengths (a line
// or two, a paragraph, the full one), so each place that presents the jury
// can take the one that fits. Country and position are asked for on every
// juror; the bios are optional.

// The same limits the jurors table checks (20261016120000_juror_profile.sql).
export const JUROR_PROFILE_LIMITS = {
  name: 120,
  job_title: 160,
  bio_short: 280,
  bio_medium: 800,
  bio_long: 3000,
} as const

export const JUROR_BIOS = [
  { field: 'bio_short', label: 'Bio corta', hint: 'Una o dos líneas.', rows: 2 },
  { field: 'bio_medium', label: 'Bio media', hint: 'Un párrafo.', rows: 4 },
  { field: 'bio_long', label: 'Bio larga', hint: 'La completa, con trayectoria.', rows: 8 },
] as const

export type JurorBioField = (typeof JUROR_BIOS)[number]['field']

export type JurorProfile = {
  name: string | null
  country_code: string
  job_title: string
  bio_short: string | null
  bio_medium: string | null
  bio_long: string | null
}

const countryCodes = new Set<string>(COUNTRY_CODES)

// Trimmed, with the textarea's CRLF as plain newlines (the form's maxlength
// counts a line break as one), cut at the column's limit; empty is null.
function text(form: FormData, field: keyof typeof JUROR_PROFILE_LIMITS) {
  const value = String(form.get(field) ?? '').replace(/\r\n?/g, '\n').trim()
  return value.slice(0, JUROR_PROFILE_LIMITS[field]).trim() || null
}

/** Reads the profile fields of the add and edit forms; an error names what's missing. */
export function parseJurorProfile(form: FormData): { profile: JurorProfile } | { error: string } {
  const country = String(form.get('country_code') ?? '').trim().toUpperCase()
  if (!countryCodes.has(country)) return { error: 'Elegí el país del jurado.' }
  const jobTitle = text(form, 'job_title')
  if (!jobTitle) return { error: 'Falta el cargo del jurado.' }
  return {
    profile: {
      name: text(form, 'name'),
      country_code: country,
      job_title: jobTitle,
      bio_short: text(form, 'bio_short'),
      bio_medium: text(form, 'bio_medium'),
      bio_long: text(form, 'bio_long'),
    },
  }
}
