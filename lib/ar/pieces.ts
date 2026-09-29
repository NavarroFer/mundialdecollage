// Cuts an obra into scissor-cut fragments for the AR "desarme" effect: start
// from the whole rectangle and keep slicing the biggest piece along a random
// straight line, the way you'd cut a print with scissors. Every cut of a
// convex polygon leaves two convex polygons, so pieces stay simple to render.

export type Point = { x: number; y: number }
export type Polygon = Point[]

// Seeded so the same obra always falls apart the same way.
export function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function area(poly: Polygon): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function centroid(poly: Polygon): Point {
  let cx = 0
  let cy = 0
  let signed = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = a.x * b.y - b.x * a.y
    signed += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  signed /= 2
  return { x: cx / (6 * signed), y: cy / (6 * signed) }
}

// Splits a convex polygon by the line through `origin` along `dir`. Returns
// null when the line misses it (everything lands on one side).
export function slice(poly: Polygon, origin: Point, dir: Point): [Polygon, Polygon] | null {
  const side = (p: Point) => dir.x * (p.y - origin.y) - dir.y * (p.x - origin.x)
  const left: Polygon = []
  const right: Polygon = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) left.push(a)
    if (sa <= 0) right.push(a)
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb)
      const hit = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      left.push(hit)
      right.push(hit)
    }
  }
  if (left.length < 3 || right.length < 3) return null
  return [left, right]
}

// `width` × `height` rectangle centered on the origin, cut into `count`
// pieces. Cuts that would leave a sliver are retried at another angle.
export function cutIntoPieces(width: number, height: number, count: number, random: () => number): Polygon[] {
  const w = width / 2
  const h = height / 2
  const pieces: Polygon[] = [[{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }]]
  const minArea = (width * height) / count / 4

  while (pieces.length < count) {
    pieces.sort((a, b) => area(b) - area(a))
    const target = pieces[0]
    const c = centroid(target)
    const span = Math.sqrt(area(target))
    let cut: [Polygon, Polygon] | null = null
    for (let attempt = 0; attempt < 12 && !cut; attempt++) {
      const angle = random() * Math.PI
      const origin = { x: c.x + (random() - 0.5) * span * 0.4, y: c.y + (random() - 0.5) * span * 0.4 }
      const result = slice(target, origin, { x: Math.cos(angle), y: Math.sin(angle) })
      if (result && area(result[0]) >= minArea && area(result[1]) >= minArea) cut = result
    }
    if (!cut) break
    pieces.splice(0, 1, cut[0], cut[1])
  }
  return pieces
}
