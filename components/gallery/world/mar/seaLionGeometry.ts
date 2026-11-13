import * as THREE from 'three'
import { WEAVE_TILE } from './textures'

// Photo reconstruction, in metres. The animal faces -X; Z is its left/right.
// Horizontal sections preserve both the pear-shaped frontal silhouette and the
// long descending back. A bent tube pinches at the shoulder and sinks the belly
// below the plinth. These sections instead describe one closed, continuous skin.
type Section = { y: number; center: number; front: number; back: number; width: number }
const BODY: Section[] = [
  { y: 0.09, center: 3.6, front: 0, back: 0, width: 0 },
  { y: 0.24, center: 1.15, front: 1.9, back: 8.8, width: 1.2 },
  { y: 0.6, center: 0.65, front: 2.0, back: 9.35, width: 1.65 },
  { y: 1.15, center: 0.35, front: 2.0, back: 8.8, width: 1.95 },
  { y: 2.0, center: 0.2, front: 2.1, back: 7.8, width: 2.15 },
  { y: 3.0, center: 0.05, front: 2.25, back: 6.3, width: 2.3 },
  { y: 4.0, center: -0.05, front: 2.4, back: 4.55, width: 2.37 },
  { y: 4.9, center: -0.16, front: 2.4, back: 2.55, width: 2.32 },
  { y: 5.8, center: -0.2, front: 2.3, back: 1.83, width: 2.16 },
  { y: 6.8, center: -0.15, front: 2.05, back: 1.6, width: 1.92 },
  { y: 7.65, center: -0.12, front: 1.7, back: 1.38, width: 1.57 },
  { y: 8.35, center: -0.06, front: 1.3, back: 1.1, width: 1.23 },
  { y: 8.95, center: 0.04, front: 0.93, back: 0.86, width: 0.94 },
  { y: 9.33, center: 0.18, front: 0.7, back: 0.62, width: 0.69 },
  { y: 9.58, center: 0.08, front: 0.39, back: 0.39, width: 0.45 },
  { y: 9.9, center: -0.04, front: 0.31, back: 0.34, width: 0.35 },
  { y: 10.22, center: -0.12, front: 0.23, back: 0.25, width: 0.27 },
  { y: 10.39, center: -0.13, front: 0, back: 0, width: 0 },
]

// Shape-preserving cubic interpolation: no overshoot at the belly or crown.
function sample(sections: Section[], y: number, key: keyof Omit<Section, 'y'>) {
  let i = 0
  while (i < sections.length - 2 && y > sections[i + 1].y) i++
  const a = sections[i]
  const b = sections[i + 1]
  const span = b.y - a.y
  const slope = (b[key] - a[key]) / span
  const tangent = (index: number) => {
    if (index === 0 || index === sections.length - 1) return slope
    const previous = sections[index - 1]
    const current = sections[index]
    const next = sections[index + 1]
    const left = (current[key] - previous[key]) / (current.y - previous.y)
    const right = (next[key] - current[key]) / (next.y - current.y)
    return left * right <= 0 ? 0 : 2 / (1 / left + 1 / right)
  }
  const t = THREE.MathUtils.clamp((y - a.y) / span, 0, 1)
  return (2 * t ** 3 - 3 * t ** 2 + 1) * a[key]
    + (t ** 3 - 2 * t ** 2 + t) * span * tangent(i)
    + (-2 * t ** 3 + 3 * t ** 2) * b[key]
    + (t ** 3 - t ** 2) * span * tangent(i + 1)
}

function surfaceGeometry(rows: THREE.Vector3[][], closedPoles = false) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const around = rows[0].length - 1
  const along = rows.length - 1
  const lengths = new Array(around + 1).fill(0)
  for (let i = 0; i <= along; i++) {
    let perimeter = 0
    for (let j = 0; j <= around; j++) {
      const point = rows[i][j]
      if (j) perimeter += point.distanceTo(rows[i][j - 1])
      if (i) lengths[j] += point.distanceTo(rows[i - 1][j])
      positions.push(point.x, point.y, point.z)
      uvs.push(perimeter / WEAVE_TILE, lengths[j] / WEAVE_TILE)
      if (i < along && j < around) {
        const a = i * (around + 1) + j
        const b = a + around + 1
        // Omit degenerate triangles at the two collapsed cap rings.
        if (!closedPoles || i > 0) indices.push(a, b, a + 1)
        if (!closedPoles || i < along - 1) indices.push(b, b + 1, a + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // The duplicated UV seam must not become a visible lighting seam.
  const normals = geometry.getAttribute('normal')
  const normal = new THREE.Vector3()
  for (let i = 0; i <= along; i++) {
    const first = i * (around + 1)
    const last = first + around
    normal.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize()
    normals.setXYZ(first, normal.x, normal.y, normal.z)
    normals.setXYZ(last, normal.x, normal.y, normal.z)
  }
  if (closedPoles) {
    for (let j = 0; j <= around; j++) {
      normals.setXYZ(j, 0, -1, 0)
      normals.setXYZ(along * (around + 1) + j, 0, 1, 0)
    }
  }
  return geometry
}

export function seaLionBodyGeometry(around = 96, along = 144) {
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= along; i++) {
    const y = BODY[0].y + (BODY[BODY.length - 1].y - BODY[0].y) * i / along
    const center = sample(BODY, y, 'center')
    const front = sample(BODY, y, 'front')
    const back = sample(BODY, y, 'back')
    const width = sample(BODY, y, 'width')
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= around; j++) {
      const angle = j / around * Math.PI * 2
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const rear = Math.max(0, c)
      // Keep the haunch broad, tapering to the tail instead of a round sausage.
      const taper = 1 - 0.44 * rear * Math.max(0, 1 - y / 5.2)
      // Very shallow irregularities in the formed skin, not shaggy animal fur.
      const relief = 1 + 0.012 * Math.sin(y * 3.6 + angle * 3) * Math.sin(angle * 7) * Math.sin(Math.PI * i / along)
      const throat = THREE.MathUtils.smoothstep(y, 5.8, 6.5) * (1 - THREE.MathUtils.smoothstep(y, 8.7, 9.2))
      const folds = 0.006 * throat * Math.sin(y * 17 + 2.4 * c + 0.3 * Math.cos(angle * 8))
      const waist = 1 - 0.44 * Math.pow(Math.max(0, 1 - y / 4.5), 1.2) * (1 - THREE.MathUtils.smoothstep(c, 0, 0.7))
      row.push(new THREE.Vector3(center + ((c < 0 ? front : back) + folds) * c, y, (width + folds) * s * taper * relief * waist))
    }
    rows.push(row)
  }
  return surfaceGeometry(rows, true)
}

type FlipperSection = { x: number; y: number; z: number; depth: number; width: number }
/** A tapered foreflipper, planted and curled forward at its broad rounded tip. */
export function seaLionForeflipperGeometry(side: 1 | -1) {
  const sections: FlipperSection[] = [
    { x: -0.62, y: 4.45, z: 1.58, depth: 0, width: 0 },
    { x: -0.87, y: 4.1, z: 1.76, depth: 0.38, width: 0.48 },
    { x: -1.05, y: 3.45, z: 1.98, depth: 0.48, width: 0.54 },
    { x: -1.2, y: 2.5, z: 2.12, depth: 0.46, width: 0.51 },
    { x: -1.45, y: 1.5, z: 2.18, depth: 0.4, width: 0.49 },
    { x: -1.7, y: 0.7, z: 2.12, depth: 0.45, width: 0.62 },
    { x: -2.03, y: 0.4, z: 2.08, depth: 0.7, width: 0.75 },
    { x: -2.15, y: 0.14, z: 2.07, depth: 0.58, width: 0.68 },
    { x: -2.1, y: 0.09, z: 2.07, depth: 0, width: 0 },
  ]
  // Ascending Y gives the same outward triangle order as the body.
  sections.reverse()
  const curve = new THREE.CatmullRomCurve3(sections.map((s) => new THREE.Vector3(s.x, s.y, s.z)), false, 'centripetal')
  const rows: THREE.Vector3[][] = []
  const along = 64
  const around = 40
  for (let i = 0; i <= along; i++) {
    const t = i / along
    const point = curve.getPoint(t)
    const section = Math.min(sections.length - 2, Math.floor(t * (sections.length - 1)))
    const f = t * (sections.length - 1) - section
    const smooth = f * f * (3 - 2 * f)
    const depth = THREE.MathUtils.lerp(sections[section].depth, sections[section + 1].depth, smooth)
    const width = THREE.MathUtils.lerp(sections[section].width, sections[section + 1].width, smooth)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= around; j++) {
      const angle = j / around * Math.PI * 2
      row.push(new THREE.Vector3(point.x + depth * Math.cos(angle), point.y, side * point.z + width * Math.sin(angle)))
    }
    rows.push(row)
  }
  return surfaceGeometry(rows, true)
}

/** Flattened, splayed rear flippers; the long edge rests on the rock bed. */
export function seaLionHindflipperGeometry(side: 1 | -1) {
  const geometry = new THREE.SphereGeometry(1, 40, 20)
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const along = (x + 1) / 2
    position.setXYZ(i, 8.8 + x * 1.8, 0.3 + y * (0.18 + 0.1 * along), side * (0.7 + along * 0.8) + z * (0.55 - along * 0.17))
  }
  geometry.computeVertexNormals()
  return geometry
}

function ellipsoid(center: [number, number, number], radii: [number, number, number], tilt = 0) {
  const geometry = new THREE.SphereGeometry(1, 48, 32)
  geometry.scale(...radii)
  geometry.rotateZ(tilt)
  geometry.translate(...center)
  return geometry
}

/**
 * The stone original clarifies the anatomy under MAR's gold covering: a raised
 * nose and a separate lower jaw, not a pair of ears. Keep that opening narrow,
 * with subtle sculpted eyes rather than a cartoon's black pupils.
 */
export function seaLionFaceGeometries() {
  const gold: THREE.BufferGeometry[] = [
    ellipsoid([-0.67, 9.44, 0], [0.28, 0.54, 0.4], -0.12),
  ]
  const recesses: THREE.BufferGeometry[] = [
    ellipsoid([-0.36, 9.66, 0], [0.045, 0.3, 0.28], 0.16),
  ]
  for (const side of [-1, 1]) {
    // Each lid follows the head's taper; the darkened same-metal inset is tiny.
    const points = Array.from({ length: 49 }, (_, i) => {
      const a = i / 48 * Math.PI * 2
      return new THREE.Vector3(0.13 + 0.22 * Math.cos(a), 9.04 + 0.145 * Math.sin(a) - 0.05 * Math.cos(a), side * (0.865 - 0.04 * Math.cos(a)))
    })
    const curve = new THREE.CatmullRomCurve3(points, true)
    gold.push(new THREE.TubeGeometry(curve, 48, 0.038, 8, true))
    recesses.push(ellipsoid([0.13, 9.04, side * 0.865], [0.175, 0.105, 0.035], -0.2))
    recesses.push(ellipsoid([-0.23, 10.3, side * 0.14], [0.055, 0.024, 0.042], 0.3))
  }
  return { gold, recesses }
}
