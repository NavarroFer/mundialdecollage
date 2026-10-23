import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { tapHintCandidates } from './tapHint'

// At eye height, looking down -Z; an obra with no rotation faces +Z, back at it.
function camera() {
  const view = new PerspectiveCamera(60, 0.5, 0.1, 100)
  view.updateMatrixWorld()
  return view
}

const obra = (id: string, position: [number, number, number], turn = 0) => ({ id, position, rotation: [0, turn, 0] as [number, number, number] })

describe('tapHintCandidates', () => {
  it('finds an obra straight ahead, centered on screen', () => {
    const [found] = tapHintCandidates([obra('ahead', [0, 0, -3])], camera())
    expect(found).toMatchObject({ id: 'ahead', distance: 3 })
    expect(found.x).toBeCloseTo(0)
    expect(found.y).toBeCloseTo(0)
  })

  it('lists the nearest first', () => {
    expect(tapHintCandidates([obra('far', [0, 0, -6]), obra('near', [0, 0, -2])], camera()).map(({ id }) => id)).toEqual(['near', 'far'])
  })

  it('skips obras too far, behind, turned away or seen edge-on', () => {
    const artworks = [
      obra('far', [0, 0, -12]),
      obra('behind', [0, 0, 3], Math.PI),
      obra('away', [0, 0, -3], Math.PI),
      obra('edge-on', [0, 0, -3], Math.PI / 2 - 0.1),
    ]
    expect(tapHintCandidates(artworks, camera())).toEqual([])
  })

  it('skips obras near the edges of the screen or down by the joysticks', () => {
    expect(tapHintCandidates([obra('side', [1.5, 0, -3]), obra('low', [0, -1.2, -3])], camera())).toEqual([])
  })
})
