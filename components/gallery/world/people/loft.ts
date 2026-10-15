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

// Ramanujan's approximation of an ellipse's perimeter.
const perimeter = (rx: number, rz: number) => Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)))

/**
 * Stacks cross-sections into a low-poly surface: with flat shading every quad
 * reads as a facet, which is the whole papercraft look. Rings must go bottom
 * to top so faces point outward. UVs are in meters (around, then up), so cloth
 * keeps the same scale on a sleeve and a coat; a closed tube's seam is at the back.
 */
export function loft(rings: readonly Ring[], options: LoftOptions = {}) {
  const { segments = 8, arc, offset = 0, pleat = 0, jitter = 0, lift } = options
  const closed = !arc
  const { capTop = closed, capBottom = closed } = options
  const [start, end] = arc ?? [offset + Math.PI, offset + Math.PI * 3]
  const columns = segments + 1
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  // Around: the average ring's length over the arc. Up: the distance climbed along the profile.
  const around = rings.reduce((sum, [, rx, rz]) => sum + perimeter(rx, rz), 0) / rings.length * (end - start) / (Math.PI * 2)
  let up = 0

  rings.forEach(([y, rx, rz, z = 0], r) => {
    if (r > 0) {
      const [py, prx, prz, pz = 0] = rings[r - 1]
      up += Math.hypot(y - py, (rx + rz - prx - prz) / 2, z - pz)
    }
    for (let i = 0; i < columns; i++) {
      // A closed tube repeats its first column so the texture seam has its own UVs.
      const column = closed ? i % segments : i
      const angle = start + (end - start) * (column / segments)
      let k = 1
      if (pleat) k += column % 2 ? pleat : -pleat
      if (jitter) k += jitter * noise(column, r)
      positions.push(Math.sin(angle) * rx * k, y + (lift?.(angle, r) ?? 0), Math.cos(angle) * rz * k + z)
      uvs.push(i / segments * around, up)
    }
  })
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * columns + i
      const c = a + columns
      indices.push(a, a + 1, c + 1, a, c + 1, c)
    }
  }
  // Caps get their own copy of the ring, mapped straight from above.
  const cap = (r: number, top: boolean) => {
    const [y, , , z = 0] = rings[r]
    const first = positions.length / 3
    for (let i = 0; i < columns; i++) {
      const [px, py, pz] = positions.slice((r * columns + i) * 3, (r * columns + i) * 3 + 3)
      positions.push(px, py, pz)
      uvs.push(px, pz)
    }
    const center = positions.length / 3
    positions.push(0, y, z)
    uvs.push(0, z)
    for (let i = 0; i < segments; i++) {
      const a = first + i
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
