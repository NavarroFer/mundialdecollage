import { beforeEach, describe, expect, it, vi } from 'vitest'

const next = vi.hoisted(() => ({
  // Like Next's: redirect() never returns.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  revalidatePath: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: next.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: next.revalidatePath }))

const db = vi.hoisted(() => ({ result: { data: null as unknown, error: null as { message: string } | null }, calls: [] as unknown[][] }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const builder: Record<string, unknown> = {}
    for (const method of ['from', 'update', 'eq', 'select']) {
      builder[method] = (...args: unknown[]) => (db.calls.push([method, ...args]), builder)
    }
    builder.single = async () => db.result
    return builder
  },
}))

import { moderate, moderationUrl, readModerationForm, type ModerationQueue } from './moderation'

const queue: ModerationQueue = { table: 'artwork_comments', path: '/admin/comentarios', anchor: 'comment' }

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeEach(() => {
  next.redirect.mockClear()
  next.revalidatePath.mockClear()
  db.result = { data: { id: 'c1' }, error: null }
  db.calls = []
})

describe('readModerationForm', () => {
  it('defaults to the pending tab', () => {
    expect(readModerationForm(form({ id: 'c1' }))).toEqual({ id: 'c1', tab: 'pendientes', next: '' })
  })
})

describe('moderationUrl', () => {
  it('goes back to the tab, at the next row or with the error', () => {
    expect(moderationUrl(queue, { tab: 'pendientes', next: 'c2' })).toBe('/admin/comentarios?tab=pendientes#comment-c2')
    expect(moderationUrl(queue, { tab: 'todos', error: 'sin permiso' })).toBe('/admin/comentarios?tab=todos&error=sin+permiso')
  })
})

describe('moderate', () => {
  it('does nothing without a row id', async () => {
    await moderate(queue, form({}), 'approved')
    expect(db.calls).toEqual([])
  })

  it('saves the status and refreshes the page', async () => {
    await moderate(queue, form({ id: 'c1' }), 'approved')
    expect(db.calls[0]).toEqual(['from', 'artwork_comments'])
    expect(db.calls[1][0]).toBe('update')
    expect(db.calls[1][1]).toMatchObject({ status: 'approved' })
    expect(db.calls[2]).toEqual(['eq', 'id', 'c1'])
    expect(next.revalidatePath).toHaveBeenCalledWith('/admin/comentarios')
  })

  it('scrolls to the next row when there is one', async () => {
    await expect(moderate(queue, form({ id: 'c1', next: 'c2' }), 'approved')).rejects.toThrow(
      'REDIRECT /admin/comentarios?tab=pendientes#comment-c2',
    )
  })

  it('shows the database error', async () => {
    db.result = { data: null, error: { message: 'boom' } }
    await expect(moderate(queue, form({ id: 'c1', next: 'c2' }), 'approved')).rejects.toThrow(
      'REDIRECT /admin/comentarios?tab=pendientes&error=boom',
    )
  })

  it('hands the updated row to the queue and shows what went wrong after', async () => {
    db.result = { data: { image_path: 'u/a.jpg' }, error: null }
    const afterModeration = vi.fn(async () => 'no se pudo borrar la foto')
    const wall: ModerationQueue = { table: 'wall_pieces', path: '/admin/muro', anchor: 'piece', columns: 'image_path', afterModeration }

    await expect(moderate(wall, form({ id: 'p1' }), 'rejected')).rejects.toThrow(
      'REDIRECT /admin/muro?tab=pendientes&error=no+se+pudo+borrar+la+foto',
    )
    expect(db.calls).toContainEqual(['select', 'image_path'])
    expect(afterModeration).toHaveBeenCalledWith(expect.objectContaining({ row: { image_path: 'u/a.jpg' }, status: 'rejected' }))
  })
})
