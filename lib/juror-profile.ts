import { COUNTRY_CODES } from '@/lib/country-codes'

// What a juror's profile holds besides the email they sign in with: name,
// country, position, a photo and the bio in up to three lengths (a line or
// two, a paragraph, the full one), so each place that presents the jury can
// take the one that fits. The admin fills it when adding the juror
// (/admin/jurado) and the juror completes it on their first visit to
// /jurado. Country and position are always asked for; the photo and
// the bios are optional.

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

/** The columns the profile forms read, for a jurors select. */
export const JUROR_PROFILE_COLUMNS = 'name, country_code, job_title, photo_path, bio_short, bio_medium, bio_long'

/** A stored profile, as it comes from the table: any field may be empty. */
export type JurorProfileValues = {
  name: string | null
  country_code: string | null
  job_title: string | null
  photo_path: string | null
} & Record<JurorBioField, string | null>

/** A profile that passed parseJurorProfile. */
export type JurorProfile = { name: string | null; country_code: string; job_title: string } & Record<JurorBioField, string | null>

const countryCodes = new Set<string>(COUNTRY_CODES)

// Trimmed, with the textarea's CRLF as plain newlines (the form's maxlength
// counts a line break as one), cut at the column's limit; empty is null.
function text(form: FormData, field: keyof typeof JUROR_PROFILE_LIMITS) {
  const value = String(form.get(field) ?? '').replace(/\r\n?/g, '\n').trim()
  return value.slice(0, JUROR_PROFILE_LIMITS[field]).trim() || null
}

/**
 * Reads the profile fields of the admin's and the juror's forms; an error
 * names what's missing. The name is optional for the admin and required
 * from the juror, who's the one who knows how it should read.
 */
export function parseJurorProfile(form: FormData, { nameRequired = false } = {}): { profile: JurorProfile } | { error: string } {
  const name = text(form, 'name')
  if (nameRequired && !name) return { error: 'Falta el nombre.' }
  const country = String(form.get('country_code') ?? '').trim().toUpperCase()
  if (!countryCodes.has(country)) return { error: 'Elegí un país.' }
  const jobTitle = text(form, 'job_title')
  if (!jobTitle) return { error: 'Falta el cargo.' }
  return {
    profile: {
      name,
      country_code: country,
      job_title: jobTitle,
      bio_short: text(form, 'bio_short'),
      bio_medium: text(form, 'bio_medium'),
      bio_long: text(form, 'bio_long'),
    },
  }
}

// The photo lives in a public bucket (20261016140000_juror_photo.sql), one
// file per upload named after its time: a new photo is a new URL, which
// /api/img caches for good (isVersionedSource in lib/r2.ts). The browser
// shrinks it first; a portrait is never shown bigger than this.
export const JUROR_PHOTO_BUCKET = 'jurors'
export const JUROR_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const JUROR_PHOTO_MAX_DIMENSION = 1200
const PHOTO_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const JUROR_PHOTO_TYPES = Object.keys(PHOTO_EXTENSIONS)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PHOTO_PATH = /^([0-9a-f-]{36})\/\d{13}\.(jpg|png|webp)$/

/** Where a new photo of this juror goes; null for a type the bucket doesn't take. */
export function jurorPhotoPath(jurorId: string, type: string, now = Date.now()): string | null {
  const extension = PHOTO_EXTENSIONS[type]
  return extension && UUID.test(jurorId) ? `${jurorId}/${now}.${extension}` : null
}

/**
 * The photo field of a profile form (JurorPhotoField): no field leaves the
 * photo as it is, an empty one removes it, and a path must be this juror's.
 */
export function parseJurorPhoto(form: FormData, jurorId: string): { photo_path?: string | null } | { error: string } {
  if (!form.has('photo_path')) return {}
  const path = String(form.get('photo_path')).trim()
  if (!path) return { photo_path: null }
  return PHOTO_PATH.exec(path)?.[1] === jurorId ? { photo_path: path } : { error: 'La foto no es válida: subila de nuevo.' }
}

export function jurorPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${JUROR_PHOTO_BUCKET}/${path}`
}
