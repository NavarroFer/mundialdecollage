import * as THREE from 'three'

/** One cross-section of a loft: height, half-width, half-depth, forward shift. */
export type Ring = readonly [y: number, rx: number, rz: number, z?: number]

export type LoftOptions = {
  segments?: number
  /** Angular span, where 0 faces +Z (a person's front). A closed tube when omitted. */
  arc?: readonly [number, number]
  /** Turns a closed tube so a face (instead of an edge) points forward. */
  offset?: number
  /** Alternating in/out radius as a fraction, for pleats (needs even segments). */
  pleat?: number
  /** Deterministic bumpiness as a fraction of the radius, for hair and cloth. */
  jitter?: number
  /** Moves single vertices up or down, e.g. to raise a hairline at the front. */
  lift?: (angle: number, ring: number) => number
  capTop?: boolean
  capBottom?: boolean
}

// Cheap hash noise in [-1, 1]; the same input always gives the same bump.
function noise(column: number, ring: number) {
  const s = Math.sin(column * 12.9898 + ring * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/**
 * Stacks cross-sections into a low-poly surface: with flat shading every quad
 * reads as a facet, which is the whole papercraft look. Rings must go bottom
 * to top so faces point outward.
 */
export function loft(rings: readonly Ring[], options: LoftOptions = {}) {
  const { segments = 8, arc, offset = 0, pleat = 0, jitter = 0, lift } = options
  const closed = !arc
  const { capTop = closed, capBottom = closed } = options
  const [start, end] = arc ?? [offset, offset + Math.PI * 2]
  const columns = segments + 1
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  rings.forEach(([y, rx, rz, z = 0], r) => {
    for (let i = 0; i < columns; i++) {
      // A closed tube repeats its first column so the texture seam has its own UVs.
      const column = closed ? i % segments : i
      const angle = start + (end - start) * (column / segments)
      let k = 1
      if (pleat) k += column % 2 ? pleat : -pleat
      if (jitter) k += jitter * noise(column, r)
      positions.push(Math.sin(angle) * rx * k, y + (lift?.(angle, r) ?? 0), Math.cos(angle) * rz * k + z)
      uvs.push(i / segments, r / (rings.length - 1))
    }
  })
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * columns + i
      const c = a + columns
      indices.push(a, a + 1, c + 1, a, c + 1, c)
    }
  }
  const cap = (r: number, top: boolean) => {
    const [y, , , z = 0] = rings[r]
    const center = positions.length / 3
    positions.push(0, y, z)
    uvs.push(0.5, top ? 1 : 0)
    for (let i = 0; i < segments; i++) {
      const a = r * columns + i
      indices.push(...(top ? [center, a, a + 1] : [center, a + 1, a]))
    }
  }
  if (capBottom) cap(0, false)
  if (capTop) cap(rings.length - 1, true)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
