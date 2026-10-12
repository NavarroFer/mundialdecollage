import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/lib/public-data-cache')
const cache = vi.hoisted(() => ({
  anonymous: true,
  entries: new Map<string, { value: unknown; tags: string[] }>(),
  invalidate: vi.fn(),
}))
vi.mock('@/lib/render-mode', () => ({ isAnonymousRender: () => cache.anonymous }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, key: string[], options: { tags: string[] }) =>
    async (...args: unknown[]) => {
      const id = JSON.stringify([key, args])
      if (cache.entries.has(id)) return cache.entries.get(id)!.value
      const value = await fn(...args)
      cache.entries.set(id, { value, tags: options.tags })
      return value
    },
  revalidateTag: (tag: string, profile: unknown) => {
    cache.invalidate(tag, profile)
    for (const [key, entry] of cache.entries) if (entry.tags.includes(tag)) cache.entries.delete(key)
  },
}))
import { cachedPublicData, refreshArtworkData, refreshPublicData } from './public-data-cache'
import { artworkTag, artistTag } from './public-cache-tags'

beforeEach(() => {
  cache.entries.clear()
  cache.invalidate.mockClear()
  cache.anonymous = true
})

describe('public cache invalidation', () => {
  it('refreshes edited artwork, its artist, listing and exhibition while retaining unrelated content and navigation order', async () => {
    const readWork = vi.fn(async (slug: string) => slug)
    const readArtist = vi.fn(async (id: string) => id)
    const work = cachedPublicData(readWork, 'published-finalist', slug => [artworkTag(slug)])
    const artist = cachedPublicData(readArtist, 'artist-profile', id => [artistTag(id)])
    const reads = ['finalists', 'exhibition', 'finalist-index', 'call-state', 'submissions-count'].map(key => {
      const read = vi.fn(async () => key)
      return { key, read, load: cachedPublicData(read, key) }
    })
    const loadAll = async () => {
      await work('one'); await work('two'); await artist('artist-one'); await artist('artist-two')
      await Promise.all(reads.map(({ load }) => load()))
    }
    await loadAll()
    refreshArtworkData([{ slug: 'one', profile_id: 'artist-one' }])
    await loadAll()
    expect(readWork.mock.calls).toEqual([['one'], ['two'], ['one']])
    expect(readArtist.mock.calls).toEqual([['artist-one'], ['artist-two'], ['artist-one']])
    for (const { key, read } of reads) expect(read).toHaveBeenCalledTimes(['finalists', 'exhibition'].includes(key) ? 2 : 1)
    expect(cache.invalidate).not.toHaveBeenCalledWith('public-data', expect.anything())
  })

  it('expires both anonymous and request variants immediately, without mixing their data', async () => {
    const read = vi.fn(async (slug: string) => {
      expect(slug).toBe('one')
      return cache.anonymous ? 'anonymous' : 'request'
    })
    const work = cachedPublicData(read, 'work', (slug: string) => [artworkTag(slug)])
    expect(await work('one')).toBe('anonymous')
    cache.anonymous = false
    expect(await work('one')).toBe('request')
    refreshArtworkData([{ slug: 'one', profile_id: 'artist' }])
    await work('one')
    cache.anonymous = true
    await work('one')
    expect(read).toHaveBeenCalledTimes(4)
    expect(cache.invalidate).toHaveBeenCalledWith(artworkTag('one'), { expire: 0 })
  })

  it('still clears every scoped entry for publication, hiding, deletion and bulk imports', async () => {
    const read = vi.fn(async () => 'visible')
    const loaders = [
      cachedPublicData(read, 'work', () => [artworkTag('one')]),
      cachedPublicData(read, 'artist-profile', () => [artistTag('artist')]),
      cachedPublicData(read, 'finalist-index'),
    ]
    await Promise.all(loaders.map(load => load()))
    refreshPublicData()
    await Promise.all(loaders.map(load => load()))
    expect(read).toHaveBeenCalledTimes(6)
  })

  it('bounds tags for long slugs and does not invalidate anything for an unlinked legacy row', () => {
    expect(artworkTag('a'.repeat(500)).length).toBeLessThan(256)
    expect(artworkTag('a')).not.toBe(artworkTag('b'))
    refreshArtworkData([])
    expect(cache.invalidate).not.toHaveBeenCalled()
  })
})
