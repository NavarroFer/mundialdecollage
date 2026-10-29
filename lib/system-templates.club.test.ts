import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isEmailDocument, renderEmailDocumentToHtml, type EmailBlock, type EmailDocument } from './email-blocks'
import { ensureSystemTemplate, SYSTEM_TEMPLATES } from './system-templates'

const SITE = 'https://site.test'
vi.mock('@/lib/site', async (original) => ({ ...(await original<typeof import('@/lib/site')>()), getSiteUrl: () => 'https://site.test' }))

type Row = { id: string; subject: string; body_html: string; body_json: unknown; translations: null; translations_source: null; updated_at: string }

// Just enough of the templates table: one stored row, found by system_key,
// updated in place.
function fakeDb(row: Row | null) {
  const state = { row, updates: [] as Record<string, unknown>[] }
  const db = {
    from: () => ({
      select: (columns: string) => ({
        eq: (column: string) => ({
          maybeSingle: async () => ({ data: state.row }),
          single: async () => ({ data: columns === 'updated_at' ? { updated_at: state.row!.updated_at } : state.row }),
          [column]: undefined,
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              state.updates.push(values)
              state.row = { ...state.row!, ...values } as Row
              return { data: state.row }
            },
          }),
        }),
      }),
    }),
  }
  return { db: db as unknown as SupabaseClient, state }
}

const doc = (...blocks: EmailBlock[]): EmailDocument => ({ blocks })
const text = (value: string): EmailBlock => ({ id: value, type: 'text', text: value, align: 'left' })
const divider = (id: string): EmailBlock => ({ id, type: 'divider' })
const button = (url: string): EmailBlock => ({ id: url, type: 'button', text: 'Ver', url, align: 'left', color: 'blue' })
const stored = (d: EmailDocument, updated_at: string): Row => ({ id: 't1', subject: 's', body_html: renderEmailDocumentToHtml(d), body_json: d, translations: null, translations_source: null, updated_at })

const BEFORE = '2026-10-20T10:00:00Z'
const AFTER = '2026-11-02T10:00:00Z'
const withStore = doc(text('intro'), button(`${SITE}/galeria-3d`), divider('store'), text('papel'), button(`${SITE}/tienda?desde=mail`), divider('footer'), text('footer'))

beforeEach(() => vi.stubEnv('CLUB_OPEN', 'on'))
afterEach(() => vi.unstubAllEnvs())

describe('the Club in «Así le fue a tu obra»', () => {
  it('asks the hook question and links to /club from the mail', () => {
    const created = SYSTEM_TEMPLATES.novedades_obra.createDocument(SITE)
    const html = renderEmailDocumentToHtml(created)
    expect(html).toContain('¿Querés que tus obras tengan su casa?')
    expect(html).toContain(`${SITE}/club?desde=mail`)
  })

  it('is left out of a new template while the Club is closed', () => {
    vi.stubEnv('CLUB_OPEN', '')
    const html = renderEmailDocumentToHtml(SYSTEM_TEMPLATES.novedades_obra.createDocument(SITE))
    expect(html).not.toContain('/club')
    expect(html).not.toContain('su casa')
  })

  it('comes before the store, and both stay', () => {
    const html = renderEmailDocumentToHtml(SYSTEM_TEMPLATES.novedades_obra.createDocument(SITE))
    expect(html.indexOf('/club?desde=mail')).toBeGreaterThan(html.indexOf('/galeria-3d'))
    expect(html.indexOf('/club?desde=mail')).toBeLessThan(html.indexOf('/tienda?desde=mail'))
  })
})

describe('ensureSystemTemplate adds the Club to a stored template', () => {
  it('once the Club is open, before the store and after the museum button', async () => {
    const { db, state } = fakeDb(stored(withStore, BEFORE))
    const result = await ensureSystemTemplate(db, 'novedades_obra')

    expect(state.updates).toHaveLength(1)
    const blocks = (result.body_json as EmailDocument).blocks
    const kinds = blocks.map((block) => block.type === 'button' ? `button:${block.url}` : block.type === 'heading' ? 'heading' : block.type)
    expect(kinds.indexOf(`button:${SITE}/club?desde=mail`)).toBeGreaterThan(kinds.indexOf(`button:${SITE}/galeria-3d`))
    expect(kinds.indexOf(`button:${SITE}/club?desde=mail`)).toBeLessThan(kinds.indexOf(`button:${SITE}/tienda?desde=mail`))
    expect(result.body_html).toContain('su casa')
    expect(isEmailDocument(result.body_json)).toBe(true)
    // the footer is the last thing in the mail
    expect(blocks.at(-1)).toMatchObject({ text: 'footer' })
  })

  it('goes before the footer when the template has no store block', async () => {
    const { db } = fakeDb(stored(doc(text('intro'), divider('footer'), text('footer')), BEFORE))
    const blocks = ((await ensureSystemTemplate(db, 'novedades_obra')).body_json as EmailDocument).blocks
    expect(blocks.findIndex((block) => block.type === 'heading')).toBeLessThan(blocks.findIndex((block) => block.id === 'footer'))
    expect(blocks.at(-1)).toMatchObject({ text: 'footer' })
  })

  it('does nothing while the Club is closed', async () => {
    vi.stubEnv('CLUB_OPEN', '')
    const { db, state } = fakeDb(stored(withStore, BEFORE))
    await ensureSystemTemplate(db, 'novedades_obra')
    expect(state.updates).toEqual([])
  })

  it('does nothing when it already links to the Club', async () => {
    const { db, state } = fakeDb(stored(doc(text('x'), button(`${SITE}/club`)), BEFORE))
    await ensureSystemTemplate(db, 'novedades_obra')
    expect(state.updates).toEqual([])
  })

  it('respects a template an admin saved after the blocks shipped', async () => {
    const { db, state } = fakeDb(stored(withStore, AFTER))
    await ensureSystemTemplate(db, 'novedades_obra')
    expect(state.updates).toEqual([])
  })

  it('leaves the other system templates alone', async () => {
    const { db, state } = fakeDb(stored(withStore, BEFORE))
    await ensureSystemTemplate(db, 'museo_hoy')
    expect(state.updates).toEqual([])
  })

  it('adds the blocks only once', async () => {
    const { db, state } = fakeDb(stored(withStore, BEFORE))
    await ensureSystemTemplate(db, 'novedades_obra')
    await ensureSystemTemplate(db, 'novedades_obra')
    expect(state.updates).toHaveLength(1)
  })
})

describe('the Club launch template', () => {
  const definition = SYSTEM_TEMPLATES.club_lanzamiento

  it('opens with the hook question and personalises the subject and greeting', () => {
    const html = renderEmailDocumentToHtml(definition.createDocument(SITE))
    expect(html).toContain('¿Querés que tus obras tengan su casa?')
    expect(definition.subject).toContain('{{nombre}}')
    expect(html).toContain('{{nombre}}')
  })

  it('sends to /club marked as coming from a mail, and states the price from the plan', () => {
    const html = renderEmailDocumentToHtml(definition.createDocument(SITE))
    expect(html).toContain(`${SITE}/club?desde=mail`)
    expect(html).toContain('$29.000')
    expect(html).toContain('USD 29')
  })

  it('is for artists, and is created whether or not the Club is open', () => {
    expect(definition.audiences).toEqual(['artistas'])
    vi.stubEnv('CLUB_OPEN', '')
    expect(renderEmailDocumentToHtml(definition.createDocument(SITE))).toContain('/club')
  })
})
