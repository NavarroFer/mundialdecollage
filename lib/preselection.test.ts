import { describe, expect, it } from 'vitest'
import {
  buildPreselectionPool,
  repeatedArtists,
  splitObraKeys,
  stageCounts,
  stageOrder,
  stageView,
  type ArtworkInput,
  type LegacyInput,
  type MarkRow,
} from './preselection'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function artwork(n: number, over: Partial<ArtworkInput> = {}): ArtworkInput {
  return {
    id: uuid(n),
    profile_id: uuid(1000 + n),
    title: `Obra ${n}`,
    technique: 'Analógica',
    image_url: `https://x.invalid/${n}.jpg`,
    created_at: `2026-10-${String(n % 28 + 1).padStart(2, '0')}T00:00:00Z`,
    is_selected: true,
    is_entered: true,
    legacy_submission_id: null,
    profiles: { name: `Artista ${n}`, country_code: 'AR', entries_chosen_at: null },
    ...over,
  }
}

function legacy(n: number, over: Partial<LegacyInput> = {}): LegacyInput {
  return {
    id: uuid(n),
    email: `a${n}@x.invalid`,
    name: `Registro ${n}`,
    country_raw: 'Argentina',
    title: `Registro obra ${n}`,
    technique: null,
    image_url: `https://x.invalid/l${n}.jpg`,
    selected: true,
    claimed_by: null,
    created_at: `2026-09-${String(n % 28 + 1).padStart(2, '0')}T00:00:00Z`,
    ...over,
  }
}

describe('buildPreselectionPool', () => {
  it('gives each artist one slot with the obra they chose', () => {
    const profile = uuid(500)
    const slots = buildPreselectionPool([
      artwork(1, { profile_id: profile, is_selected: true, profiles: { name: 'Ana', country_code: 'AR', entries_chosen_at: '2026-10-01' } }),
      artwork(2, { profile_id: profile, is_selected: false, is_entered: true, profiles: { name: 'Ana', country_code: 'AR', entries_chosen_at: '2026-10-01' } }),
      artwork(3),
    ], [], new Set())
    expect(slots.map((s) => s.obra.key).sort()).toEqual([`artwork:${uuid(1)}`, `artwork:${uuid(3)}`].sort())
    expect(slots.find((s) => s.key === `artwork:${uuid(1)}`)?.alternatives).toEqual([])
  })

  it('takes every entered obra of an artist who paid, each in its own slot', () => {
    const profile = uuid(501)
    const profiles = { name: 'Bea', country_code: 'UY', entries_chosen_at: '2026-10-01' }
    const slots = buildPreselectionPool([
      artwork(1, { profile_id: profile, is_selected: true, profiles }),
      artwork(2, { profile_id: profile, is_selected: false, is_entered: true, profiles }),
      artwork(3, { profile_id: profile, is_selected: false, is_entered: false, profiles }),
    ], [], new Set([profile]))
    expect(slots.map((s) => s.key).sort()).toEqual([`artwork:${uuid(1)}`, `artwork:${uuid(2)}`].sort())
  })

  it('lets the organizers pick when an artist with several obras never chose', () => {
    const rows = [
      legacy(1, { email: 'c@x.invalid', selected: false, created_at: '2026-09-01T00:00:00Z' }),
      legacy(2, { email: 'c@x.invalid', selected: true, created_at: '2026-09-05T00:00:00Z' }),
    ]
    const [slot] = buildPreselectionPool([], rows, new Set())
    expect(slot.key).toBe(`legacy:${uuid(2)}`)
    expect(slot.alternatives.map((o) => o.key)).toEqual([`legacy:${uuid(2)}`, `legacy:${uuid(1)}`])

    const [swapped] = buildPreselectionPool([], rows, new Set(), new Map([[`legacy:${uuid(2)}`, `legacy:${uuid(1)}`]]))
    expect(swapped.key).toBe(`legacy:${uuid(2)}`)
    expect(swapped.obra.key).toBe(`legacy:${uuid(1)}`)
  })

  it('ignores a choice that is not one of the artist’s obras', () => {
    const rows = [legacy(1, { email: 'd@x.invalid', selected: false }), legacy(2, { email: 'd@x.invalid' })]
    const [slot] = buildPreselectionPool([], rows, new Set(), new Map([[`legacy:${uuid(2)}`, `legacy:${uuid(9)}`]]))
    expect(slot.obra.key).toBe(`legacy:${uuid(2)}`)
  })

  it('shows a Registro row for the artwork linked from it, once', () => {
    const profile = uuid(502)
    const slots = buildPreselectionPool(
      [artwork(7, { profile_id: profile, legacy_submission_id: uuid(1), profiles: { name: 'Eva', country_code: 'CL', entries_chosen_at: null } })],
      [legacy(1, { claimed_by: profile, country_raw: null })],
      new Set(),
    )
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ key: `legacy:${uuid(1)}`, countryCode: 'CL', artistKey: `profile:${profile}` })
  })

  it('leaves out obras without a photo and native obras not entered', () => {
    const slots = buildPreselectionPool(
      [artwork(1, { image_url: null }), artwork(2, { is_entered: false, is_selected: false })],
      [legacy(3, { image_url: null })],
      new Set(),
    )
    expect(slots).toEqual([])
  })
})

describe('stages', () => {
  const slots = Array.from({ length: 10 }, (_, i) => ({ key: `artwork:${uuid(i + 1)}` }))

  it('orders each stage the same way every time, and differently per stage', () => {
    expect(stageOrder(slots, 1)).toEqual(stageOrder([...slots].reverse(), 1))
    expect(stageOrder(slots, 1).map((s) => s.key)).not.toEqual(stageOrder(slots, 2).map((s) => s.key))
  })

  it('keeps for the next stage only what was picked in the one before', () => {
    const order = stageOrder(slots, 1)
    const marks: MarkRow[] = order.slice(0, 4).map((s, i) => ({ stage: 1, slot_key: s.key, picked: i < 2, batch: 1 }))
    const one = stageView(slots, marks, 1)
    expect(one.open.map((s) => s.key)).toEqual(order.slice(4).map((s) => s.key))
    expect(one.lastBatch).toBe(1)
    const two = stageView(slots, marks, 2)
    expect(two.pool.map((s) => s.key).sort()).toEqual(order.slice(0, 2).map((s) => s.key).sort())
    expect(two.seen.size).toBe(0)
  })

  it('counts what is picked, what is left and where the pass ends at this pace', () => {
    const order = stageOrder(slots, 1)
    const marks: MarkRow[] = [
      ...order.slice(0, 5).map((s, i) => ({ stage: 1, slot_key: s.key, picked: i === 0, batch: 1 })),
      // Picked in the batch still on screen: counted, not projected from.
      { stage: 1, slot_key: order[5].key, picked: true, batch: null },
    ]
    expect(stageCounts(stageView(slots, marks, 1), 20)).toEqual({
      total: 10, seen: 5, remaining: 5, pickedSeen: 1, picked: 2, projected: 2, target: 2,
    })
  })
})

describe('repeatedArtists', () => {
  it('finds one artist picked twice, by account or by name', () => {
    const slots = [
      { key: 'a', artistKey: 'profile:1', artist: 'Ana Pérez' },
      { key: 'b', artistKey: 'profile:1', artist: 'Ana Pérez' },
      { key: 'c', artistKey: 'email:x', artist: 'ana perez' },
      { key: 'd', artistKey: 'profile:2', artist: 'Bea' },
      { key: 'e', artistKey: 'profile:3', artist: 'Sin nombre' },
      { key: 'f', artistKey: 'profile:4', artist: 'Sin nombre' },
    ]
    const groups = repeatedArtists(slots, new Set(['a', 'c', 'd', 'e', 'f']))
    expect(groups.map((g) => g.map((s) => s.key).sort())).toEqual([['a', 'c']])
  })
})

it('splits final keys by table', () => {
  expect(splitObraKeys([`artwork:${uuid(1)}`, `legacy:${uuid(2)}`])).toEqual({ artworkIds: [uuid(1)], legacyIds: [uuid(2)] })
})
