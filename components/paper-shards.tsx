'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { cn } from '@/lib/utils'

// Torn scraps of the brand's papers streaming along five ribbons at
// different depths, after React Bits' Aero Shards (glass shards on WebGPU).
// Paper is flat and opaque, so a plain 2D canvas draws it on every browser,
// with no shaders and no dependency. The two far ribbons go on a
// half-resolution, slightly blurred canvas behind: the depth of field.
// Called to gather, each big paper of the brand (components/brand-papers.tsx)
// unrolls from the logo's side outward: a torn front sweeps across it, the
// scraps of its color peel off the stream to land right on that front, all
// curving the same way and lining up with the paper, and behind the front
// they're one sheet. The paper moves as one body the whole time, drifting
// out as it forms and speeding up to leave, its landed scraps riding along.

/** How a paper leaves the frame: moved (px), turned (degrees), maybe faded. */
export type PaperExit = { x: number; y: number; turn: number; delay: number; fade: boolean }

/** A paper to gather into: its outline and pivot in the component's pixels. */
export type PaperTarget = { ink: 'blue' | 'red' | 'yellow'; polygon: number[][]; pivot: number[]; exit: PaperExit }

export type PaperGathering = {
  /** Every scrap has landed: the papers are whole and on their way out. */
  formed: Promise<void>
  /** The papers are out of the frame and nothing draws any more. */
  gone: Promise<void>
}

export type PaperShardsHandle = {
  /** The scraps rush off their ribbons and out of the frame. */
  leave: () => void
  /** The scraps come together into these papers, which then leave. */
  gather: (targets: PaperTarget[]) => PaperGathering
}

type PaperShardsProps = {
  ref?: Ref<PaperShardsHandle>
  className?: string
  /** How fast the ribbons flow: 1 is a calm drift. */
  speed?: number
}

type RGB = [number, number, number]

type Scrap = {
  level: number
  /** Where on its ribbon, 0 (left) to 1 (right). */
  phase: number
  /** Across the ribbon, -1 to 1. */
  lane: number
  size: number
  ink: number
  /** Printed on one side only: the back is plain newsprint. */
  plainBack: boolean
  yaw: number
  bank: number
  /** Turns over and over as it flows (rad/s); most don't. */
  spin: number
  flutter: number
  rate: number
  arrive: number
  sign: number
  shape: Path2D
  rim: Path2D
  // Pushed aside by the pointer, springing back.
  ox: number
  oy: number
  vx: number
  vy: number
  // Its paper and spot in it while gathering (in the paper's resting place);
  // no paper (-1) when none of its color wants it, so it shrinks off instead.
  gatherAt: number
  paper: number
  slotX: number
  slotY: number
  slotAngle: number
  slotRadius: number
}

const TAU = Math.PI * 2
const CAMERA = 4
const DEPTHS = [2.7, 3.9, 5.6, 8.1, 11.6]
const SHARE = [0.26, 0.23, 0.2, 0.17, 0.14]
// Far scraps are bigger, so every ribbon reads at a similar size on screen.
const GROWTH = [1, 1.3, 1.8, 2.6, 3.6]
// How far each depth fades into the paper behind it.
const HAZE = [0, 0.12, 0.26, 0.42, 0.56]
const SLOPES = [
  [0.2, -0.78],
  [-0.72, 0.02],
  [0.58, -0.06],
  [-0.24, 0.62],
  [0.8, 0.3],
]
const SHADOWS: (number | undefined)[] = [0.15, 0.11, 0.07]
const FIRST_BACK_LEVEL = 3
const SAMPLES = 96
const SCRAP = 0.05
const SCRAPS_PER_SCREEN = 520
const SHADES = 7
const INTRO_SECONDS = 0.45
const LEAVE_SECONDS = 0.55
// One scrap's flight from the stream to its spot.
const GATHER_SECONDS = 0.5
// The torn front's sweep across a paper, from its inner edge to its outer.
const UNROLL_SECONDS = 0.6
// Then the paper carries on out of the frame.
const PAPER_EXIT_SECONDS = 0.6
// A paper starts this share of its way out back inward of its place, so it
// is already moving as it forms.
const PULL_BACK = 0.08
// How long a landed scrap's white torn edge takes to melt into the paper.
const MELT_SECONDS = 0.3
const HAZE_STEPS = 12
const INKS = ['blue', 'red', 'yellow'] as const
// Ribbons per second, the nearest one.
const FLOW = 0.05

// The splash's papers (app/globals.css). Most are colored through, like
// construction paper; the rest have a plain newsprint back.
const FALLBACK = { paper: '#faf8f2', ink: '#1b110c', blue: '#11458c', red: '#d4302e', yellow: '#e79d00' }
const BACK: RGB = [236, 230, 216]
const RIM: RGB = [255, 253, 248]
const INK_WEIGHTS = [0.38, 0.32, 0.24, 0.06]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const smoother = (x: number) => {
  const t = clamp(x, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const easeInOut = (x: number) => {
  const t = clamp(x, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const turnTowards = (from: number, to: number, t: number) => {
  const delta = ((((to - from) % TAU) + TAU * 1.5) % TAU) - Math.PI
  return from + delta * t
}

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function parseHex(value: string): RGB | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const hex = parseInt(match[1], 16)
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function mix(a: RGB, b: RGB, t: number): string {
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`
}

function shade(color: RGB, light: number): RGB {
  return [color[0] * light, color[1] * light, color[2] * light]
}

// A scrap's outline, long axis along x, torn along every edge; strips keep
// their long sides straight, cut with scissors.
function tornOutline(next: () => number): number[][] {
  const family = next()
  let outline: number[][]
  let straightLongSides = false
  if (family < 0.4) {
    const spread = 0.2 + next() * 0.16
    outline = [
      [1, (next() - 0.5) * 0.1],
      [-0.55 - next() * 0.25, spread * (0.8 + next() * 0.4)],
      [-0.55 - next() * 0.25, -spread * (0.8 + next() * 0.4)],
    ]
  } else if (family < 0.65) {
    const spread = 0.24 + next() * 0.16
    outline = [
      [1, 0],
      [(next() - 0.3) * 0.5, spread],
      [-0.6 - next() * 0.2, (next() - 0.5) * 0.1],
      [(next() - 0.3) * 0.5, -spread * (0.8 + next() * 0.4)],
    ]
  } else if (family < 0.86) {
    const sides = next() < 0.5 ? 4 : 5
    const stretch = 0.45 + next() * 0.3
    const turn = next() * TAU
    outline = []
    for (let corner = 0; corner < sides; corner += 1) {
      const angle = turn + ((corner + (next() - 0.5) * 0.6) * TAU) / sides
      outline.push([Math.cos(angle), Math.sin(angle) * stretch])
    }
  } else {
    const half = 0.13 + next() * 0.1
    outline = [
      [-1, -half],
      [1, -half * (0.8 + next() * 0.3)],
      [1, half],
      [-1, half * (0.8 + next() * 0.3)],
    ]
    straightLongSides = true
  }

  const points: number[][] = []
  for (let i = 0; i < outline.length; i += 1) {
    const [ax, ay] = outline[i]
    const [bx, by] = outline[(i + 1) % outline.length]
    const length = Math.hypot(bx - ax, by - ay) || 1
    const torn = !(straightLongSides && i % 2 === 0)
    const steps = torn ? 2 + Math.round(length * (2 + next() * 3)) : 1
    const nx = -(by - ay) / length
    const ny = (bx - ax) / length
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps
      const jag = k === 0 ? 0 : (next() - 0.5) * 0.11
      points.push([ax + (bx - ax) * t + nx * jag, ay + (by - ay) * t + ny * jag])
    }
  }

  let mx = 0
  let my = 0
  for (const [x, y] of points) {
    mx += x / points.length
    my += y / points.length
  }
  let reach = 0
  for (const point of points) {
    point[0] -= mx
    point[1] -= my
    reach = Math.max(reach, Math.hypot(point[0], point[1]))
  }
  for (const point of points) {
    point[0] /= reach
    point[1] /= reach
  }
  return points
}

function toPath(points: number[][], grow?: () => number): Path2D {
  const path = new Path2D()
  points.forEach(([x, y], index) => {
    const scale = grow ? grow() : 1
    if (index === 0) path.moveTo(x * scale, y * scale)
    else path.lineTo(x * scale, y * scale)
  })
  path.closePath()
  return path
}

function createScraps(count: number): Scrap[] {
  const next = random(1337)
  const scraps: Scrap[] = []
  let made = 0
  for (let level = 0; level < DEPTHS.length; level += 1) {
    const amount = level === DEPTHS.length - 1 ? count - made : Math.round(count * SHARE[level])
    made += amount
    for (let index = 0; index < amount; index += 1) {
      const outline = tornOutline(next)
      let pick = next()
      let ink = 0
      while (ink < INK_WEIGHTS.length - 1 && pick > INK_WEIGHTS[ink]) {
        pick -= INK_WEIGHTS[ink]
        ink += 1
      }
      const flat = next() * 2 - 1
      scraps.push({
        level,
        phase: (index + next()) / Math.max(amount, 1),
        lane: Math.sign(flat) * Math.pow(Math.abs(flat), 0.85),
        size: 0.6 + next() * next() * 1.25,
        ink,
        plainBack: next() < 0.25,
        yaw: (next() - 0.5) * 0.5,
        bank: (next() - 0.5) * 0.6,
        spin: next() < 0.22 ? (next() - 0.5) * 3 : 0,
        flutter: next() * TAU,
        rate: 0.6 + next() * 0.8,
        arrive: next(),
        sign: next() < 0.5 ? -1 : 1,
        shape: toPath(outline),
        // The white fiber a tear leaves along the edge, wider in places.
        rim: toPath(outline, () => 1.03 + next() * 0.09),
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        gatherAt: -1,
        paper: -1,
        slotX: 0,
        slotY: 0,
        slotAngle: 0,
        slotRadius: 0,
      })
    }
  }
  return scraps
}

const DONE: PaperGathering = { formed: Promise.resolve(), gone: Promise.resolve() }

type Paper = {
  color: string
  polygon: number[][]
  pivot: number[]
  exit: PaperExit
  // Its way out (unit), which it unrolls along too, starting at its
  // innermost spot and reaching this far (px).
  dirX: number
  dirY: number
  anchor: number[]
  reach: number
  /** Its torn front's ragged edge, and the side its scraps curve to. */
  tear: Float32Array
  bend: number
  spacing: number
  across: number[]
  // This frame: how far the front has gone, how far out the paper is, and
  // where that puts it.
  unrolled: number
  out: number
  cos: number
  sin: number
  dx: number
  dy: number
}

// A point of the paper's resting place, wherever the paper is now.
function carry(paper: Paper, x: number, y: number): [number, number] {
  const rx = x - paper.pivot[0]
  const ry = y - paper.pivot[1]
  return [
    paper.pivot[0] + paper.cos * rx - paper.sin * ry + paper.dx,
    paper.pivot[1] + paper.sin * rx + paper.cos * ry + paper.dy,
  ]
}

type Marker = { u: number; v: number; level: number; ring: boolean }

function createMarkers(): Marker[] {
  const next = random(7)
  return Array.from({ length: 16 }, () => ({
    u: (next() - 0.5) * 1.84,
    v: (next() - 0.5) * 1.76,
    level: 1 + Math.floor(next() * 4),
    ring: next() < 0.3,
  }))
}

function inside(polygon: number[][], x: number, y: number) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

// Where the scraps land in a paper: a jittered grid over the part of it on
// screen, as fine as the scraps going there need to cover it.
function slotsIn(polygon: number[][], count: number, width: number, height: number, next: () => number) {
  const margin = 16
  const xs = polygon.map(([x]) => x)
  const ys = polygon.map(([, y]) => y)
  const left = Math.max(-margin, Math.min(...xs))
  const right = Math.min(width + margin, Math.max(...xs))
  const top = Math.max(-margin, Math.min(...ys))
  const bottom = Math.min(height + margin, Math.max(...ys))
  if (right <= left || bottom <= top || count === 0) return { slots: [] as number[][], spacing: 0 }
  let hits = 0
  const probes = 32
  for (let i = 0; i < probes; i += 1) {
    for (let j = 0; j < probes; j += 1) {
      if (inside(polygon, left + ((i + 0.5) / probes) * (right - left), top + ((j + 0.5) / probes) * (bottom - top))) hits += 1
    }
  }
  const area = (hits / (probes * probes)) * (right - left) * (bottom - top)
  const spacing = Math.sqrt(area / count)
  const slots: number[][] = []
  if (spacing <= 0) return { slots, spacing }
  for (let row = 0, y = top + spacing / 2; y < bottom; row += 1, y += spacing * 0.87) {
    for (let x = left + (row % 2 ? spacing / 2 : 0); x < right; x += spacing) {
      const sx = x + (next() - 0.5) * spacing * 0.5
      const sy = y + (next() - 0.5) * spacing * 0.5
      if (inside(polygon, sx, sy)) slots.push([sx, sy])
    }
  }
  return { slots, spacing }
}

// Each ribbon's centerline in screen pixels, with its depth and direction.
function ribbon(level: number, width: number, height: number): Float32Array {
  const out = new Float32Array((SAMPLES + 1) * 5)
  const [from, to] = SLOPES[level]
  for (let i = 0; i <= SAMPLES; i += 1) {
    const s = i / SAMPLES
    const u = -1.32 + 2.64 * s
    const v = from + (to - from) * s + 0.1 * Math.sin(s * TAU * 0.7 + level * 2.3) + 0.045 * Math.sin(s * TAU * 1.9 + level)
    out[i * 5] = width / 2 + (u * width) / 2
    out[i * 5 + 1] = height / 2 - (v * height) / 2
    out[i * 5 + 2] = DEPTHS[level] + 0.35 * Math.sin(s * Math.PI * 1.4 + level * 1.9)
  }
  for (let i = 0; i <= SAMPLES; i += 1) {
    const a = Math.max(0, i - 1)
    const b = Math.min(SAMPLES, i + 1)
    const tx = out[b * 5] - out[a * 5]
    const ty = out[b * 5 + 1] - out[a * 5 + 1]
    const length = Math.hypot(tx, ty) || 1
    out[i * 5 + 3] = tx / length
    out[i * 5 + 4] = ty / length
  }
  return out
}

function startPaperShards(container: HTMLElement, front: HTMLCanvasElement, back: HTMLCanvasElement, speed: number) {
  const frontContext = front.getContext('2d')
  const backContext = back.getContext('2d')
  if (!frontContext || !backContext) return { leave() {}, gather: () => DONE, dispose() {} }

  const style = getComputedStyle(container)
  const color = (name: string, fallback: string) => parseHex(style.getPropertyValue(name)) ?? parseHex(fallback)!
  const paper = color('--paper', FALLBACK.paper)
  const ink = color('--ink', FALLBACK.ink)
  const inks = [color('--collage-blue', FALLBACK.blue), color('--collage-red', FALLBACK.red), color('--collage-yellow', FALLBACK.yellow), ink]

  // Every fill string made once: by haze (how far into the paper behind),
  // ink (newsprint last) and how squarely the scrap faces the light. The
  // back sits in its own shadow. Face-on and clear, a scrap is exactly its
  // paper's color, so landed ones melt into the big paper.
  const hazes = Array.from({ length: HAZE_STEPS }, (_, step) => (HAZE[HAZE.length - 1] * step) / (HAZE_STEPS - 1))
  const fillsFor = (darken: number) =>
    hazes.map((haze) =>
      [...inks, BACK].map((base) =>
        Array.from({ length: SHADES }, (_, step) =>
          mix(shade(base, darken * (0.68 + (0.32 * step) / (SHADES - 1))), paper, haze),
        ),
      ),
    )
  const fronts = fillsFor(1)
  const backs = fillsFor(0.8)
  const rims = hazes.map((haze) => mix(RIM, paper, haze))
  const inkStroke = `rgb(${ink[0]} ${ink[1]} ${ink[2]})`
  const hazeStep = (haze: number) => Math.round((haze / HAZE[HAZE.length - 1]) * (HAZE_STEPS - 1))

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let width = 0
  let height = 0
  let ratio = 1
  let ribbons: Float32Array[] = []
  let scraps: Scrap[] = []
  const markers = createMarkers()
  const travel = new Float64Array(DEPTHS.length)
  let clock = 0
  let drift = 0
  let twist = 0
  let leaveAt = -1
  let gatherStart = -1
  let formStart = -1
  let formedAt = -1
  let goneAt = -1
  let formed: (() => void) | null = null
  let gone: (() => void) | null = null
  let papers: Paper[] = []
  let cleared = false
  let last = 0
  let raf = 0
  const next = random(99)
  const pointer = { x: 0, y: 0, inside: false, presence: 0, px: 0, py: 0 }

  // Per frame, per scrap: where it lands and how it's turned.
  let screenX = new Float32Array(0)
  let screenY = new Float32Array(0)
  let depth = new Float32Array(0)
  let angle = new Float32Array(0)
  let radius = new Float32Array(0)
  let flip = new Float32Array(0)
  let haze = new Float32Array(0)
  let blend = new Float32Array(0)
  let alpha = new Float32Array(0)
  // Drawn in three passes: the stream, each paper with the scraps landed in
  // it, and the scraps in flight on top.
  const order: number[] = []
  const flying: number[] = []
  let landedIn: number[][] = []

  const resize = () => {
    width = container.clientWidth
    height = container.clientHeight
    ratio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2)
    front.width = Math.max(1, Math.round(width * ratio))
    front.height = Math.max(1, Math.round(height * ratio))
    back.width = Math.max(1, Math.round(width * ratio * 0.5))
    back.height = Math.max(1, Math.round(height * ratio * 0.5))
    ribbons = DEPTHS.map((_, level) => ribbon(level, width, height))
    const count = Math.round(SCRAPS_PER_SCREEN * clamp((width * height) / (1440 * 900), 0.45, 1.25))
    if (Math.abs(count - scraps.length) > scraps.length * 0.1) {
      scraps = createScraps(count)
      screenX = new Float32Array(count)
      screenY = new Float32Array(count)
      depth = new Float32Array(count)
      angle = new Float32Array(count)
      radius = new Float32Array(count)
      flip = new Float32Array(count)
      haze = new Float32Array(count)
      blend = new Float32Array(count)
      alpha = new Float32Array(count)
    }
  }

  const place = (dt: number) => {
    const focal = (CAMERA * height) / 2
    const intro = !reduced
    const rush = leaveAt < 0 ? 0 : smoother((clock - leaveAt) / LEAVE_SECONDS)
    const reach = 0.13 * Math.min(width, height)
    const diagonal = Math.hypot(width, height)
    // One continuous curve per paper: a steady drift out while it forms,
    // speeding up to leave.
    for (const paper of papers) {
      const u = clamp((clock - formStart - paper.exit.delay) / (UNROLL_SECONDS + PAPER_EXIT_SECONDS), 0, 1)
      paper.out = -PULL_BACK + (1 + PULL_BACK) * (0.2 * u + 0.8 * u * u * u)
      const sweep = (clock - formStart) / UNROLL_SECONDS
      paper.unrolled = sweep >= 1 ? Infinity : paper.reach * Math.max(0, sweep)
      const turn = ((paper.exit.turn * Math.PI) / 180) * paper.out
      paper.cos = Math.cos(turn)
      paper.sin = Math.sin(turn)
      paper.dx = paper.exit.x * paper.out
      paper.dy = paper.exit.y * paper.out
    }
    order.length = 0
    flying.length = 0
    for (const list of landedIn) list.length = 0
    for (let index = 0; index < scraps.length; index += 1) {
      const scrap = scraps[index]
      const level = scrap.level
      let s = (scrap.phase + travel[level]) % 1
      let appear = 1
      let tumble = 0
      if (intro) {
        const begin = level * 0.05 + s * 0.3 + scrap.arrive * 0.1
        const local = clamp((clock - begin) / INTRO_SECONDS, 0, 1)
        appear = smoother(local)
        const glide = (1 - local) * (1 - local)
        s = Math.max(0, s - glide * 0.08)
        tumble = glide * 2.4 * scrap.sign
      }
      const gathered = scrap.gatherAt < 0 ? 0 : easeInOut((clock - scrap.gatherAt) / GATHER_SECONDS)
      if (appear <= 0.01 && gathered === 0) continue

      const path = ribbons[level]
      const f = s * SAMPLES
      const i0 = Math.min(Math.floor(f), SAMPLES - 1)
      const t = f - i0
      const at = (c: number) => path[i0 * 5 + c] + (path[i0 * 5 + 5 + c] - path[i0 * 5 + c]) * t
      const cx = at(0)
      const cy = at(1)
      const d = at(2)
      const tx = at(3)
      const ty = at(4)
      const nx = -ty
      const ny = tx

      // The ribbon twists around its own line, so its scraps swing in depth
      // and turn edge-on together, like silk.
      const D = DEPTHS[level]
      const turn = s * TAU * 0.6 + twist + level * 1.7
      const across = 0.7 * (0.15 + 0.035 * D)
      const spread = across * (0.8 + 0.3 * Math.sin(s * TAU * 1.3 + level * 0.8))
      const taper = smoother(s / 0.12) * smoother((1 - s) / 0.12)
      const lane = scrap.lane * spread
      const z = d + lane * Math.sin(turn)
      const toScreen = focal / z
      const billow =
        0.16 * (D / CAMERA) * Math.sin(s * TAU * 1.3 - drift * 0.5 + level * 1.1) * (0.4 + 0.6 * taper) +
        0.06 * (D / CAMERA) * Math.sin(s * TAU * 0.8 - drift * 0.35 + level * 2.4)
      const offset = (lane * Math.cos(turn) + billow) * toScreen
      const near = DEPTHS[0] / z
      let x = cx + nx * offset - (pointer.px - 0.5) * 22 * near
      let y = cy + ny * offset - (pointer.py - 0.5) * 22 * near

      if (!reduced) {
        let fx = 0
        let fy = 0
        if (pointer.presence > 0.001 && gathered === 0) {
          const dx = x + scrap.ox - pointer.x
          const dy = y + scrap.oy - pointer.y
          const gap = Math.hypot(dx, dy)
          const push = pointer.presence * Math.exp(-(gap * gap) / (reach * reach)) * near
          if (push > 0.002 && gap > 0.5) {
            fx = (dx / gap) * push * 2600
            fy = (dy / gap) * push * 2600
          }
        }
        scrap.vx += (fx - scrap.ox * 40 - scrap.vx * 9) * dt
        scrap.vy += (fy - scrap.oy * 40 - scrap.vy * 9) * dt
        scrap.ox += scrap.vx * dt
        scrap.oy += scrap.vy * dt
        x += scrap.ox
        y += scrap.oy
      }

      const facing = Math.cos(
        turn +
          scrap.bank +
          0.35 * Math.sin(clock * scrap.rate + scrap.flutter) +
          scrap.spin * clock +
          tumble +
          rush * 7 * scrap.sign,
      )
      let turned = Math.atan2(ty, tx) + scrap.yaw + 0.06 * Math.sin(clock * scrap.rate * 0.7 + scrap.flutter)
      let size = SCRAP * scrap.size * GROWTH[level] * toScreen * appear * (0.35 + 0.65 * taper)
      let facingNow = facing
      let sortDepth = z
      let opacity = 1
      if (gathered > 0) {
        const paper = papers[scrap.paper]
        if (!paper) {
          size *= 1 - gathered
        } else {
          // Off the stream along a slight curve after its spot, which moves
          // with the paper, turning flat to land.
          // All of a paper's scraps curve the same way, like a flock.
          const [slotX, slotY] = carry(paper, scrap.slotX, scrap.slotY)
          const dx = slotX - x
          const dy = slotY - y
          const swirl = Math.sin(Math.PI * gathered) * paper.bend * (0.12 + 0.12 * scrap.arrive)
          x += dx * gathered - dy * swirl
          y += dy * gathered + dx * swirl
          turned = turnTowards(turned, scrap.slotAngle + Math.atan2(paper.sin, paper.cos), gathered)
          size += (scrap.slotRadius - size) * gathered
          facingNow = facing + (1 - facing) * gathered
          sortDepth = z * (1 - gathered)
          if (paper.exit.fade) opacity = 1 - smoother(paper.out)
        }
      }

      if (rush > 0) {
        const dx = x - width / 2
        const dy = y - height / 2
        const gap = Math.hypot(dx, dy) || 1
        const fling = rush * rush * diagonal * 0.8 * Math.sqrt(near)
        x += (dx / gap) * fling
        y += (dy / gap) * fling
      }

      if (size < 0.5) continue
      screenX[index] = x
      screenY[index] = y
      depth[index] = sortDepth
      angle[index] = turned
      radius[index] = size
      flip[index] = Math.sign(facingNow || 1) * Math.max(Math.abs(facingNow), 0.07)
      haze[index] = HAZE[level] * (1 - gathered)
      blend[index] = gathered
      alpha[index] = opacity
      if (gathered === 0 || !papers[scrap.paper]) order.push(index)
      else if (gathered < 1) flying.push(index)
      else landedIn[scrap.paper].push(index)
    }
    order.sort((a, b) => depth[b] - depth[a])
    flying.sort((a, b) => blend[a] - blend[b])
  }

  const drawMarkers = () => {
    const rush = leaveAt < 0 ? 0 : smoother((clock - leaveAt) / LEAVE_SECONDS)
    const gathering = gatherStart < 0 ? 0 : smoother((clock - gatherStart) / 0.4)
    const show = (reduced ? 1 : smoother((clock - 0.15) / 0.5)) * (1 - rush) * (1 - gathering)
    if (show <= 0) return
    const context = frontContext
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.strokeStyle = inkStroke
    context.lineWidth = 1.2
    for (const marker of markers) {
      const near = DEPTHS[0] / DEPTHS[marker.level]
      const x = width / 2 + (marker.u * width) / 2 - (pointer.px - 0.5) * 22 * near
      const y = height / 2 - (marker.v * height) / 2 - (pointer.py - 0.5) * 22 * near
      const arm = 4 + 4 * near
      context.globalAlpha = show * (0.18 + 0.2 * near)
      context.beginPath()
      context.moveTo(x - arm, y)
      context.lineTo(x + arm, y)
      context.moveTo(x, y - arm)
      context.lineTo(x, y + arm)
      if (marker.ring) {
        context.moveTo(x + arm * 0.6, y)
        context.arc(x, y, arm * 0.6, 0, TAU)
      }
      context.stroke()
    }
    context.globalAlpha = 1
  }

  // One scrap: its shadow (lifted off what's below by `lift`), its white
  // torn rim, then the paper itself.
  const drawScrap = (index: number, context: CanvasRenderingContext2D, k: number, lift: number, rim: number) => {
    const scrap = scraps[index]
    const level = scrap.level
    const r = radius[index]
    const c = Math.cos(angle[index]) * r * k
    const sn = Math.sin(angle[index]) * r * k
    const fl = flip[index]
    const x = screenX[index] * k
    const y = screenY[index] * k
    const hazed = hazeStep(haze[index])
    if (lift > 0.01) {
      const offset = (DEPTHS[0] / Math.max(depth[index], DEPTHS[0])) * k * lift
      context.globalAlpha = (SHADOWS[level] ?? 0.06) * alpha[index]
      context.setTransform(c, sn, -sn * fl, c * fl, x + 3 * offset, y + 5 * offset)
      context.fillStyle = inkStroke
      context.fill(scrap.shape)
    }
    context.setTransform(c, sn, -sn * fl, c * fl, x, y)
    const newsprint = fl < 0 && scrap.plainBack
    if (rim > 0.01 && !newsprint) {
      context.globalAlpha = rim * alpha[index]
      context.fillStyle = rims[hazed]
      context.fill(scrap.rim)
    }
    const step = Math.round(Math.abs(fl) * (SHADES - 1))
    context.globalAlpha = alpha[index]
    context.fillStyle = newsprint ? fronts[hazed][inks.length][step] : (fl >= 0 ? fronts : backs)[hazed][scrap.ink][step]
    context.fill(scrap.shape)
    context.globalAlpha = 1
  }

  const tracePaper = (context: CanvasRenderingContext2D, paper: Paper, points: number[][]) => {
    context.beginPath()
    points.forEach(([px, py], corner) => {
      const [x, y] = carry(paper, px, py)
      if (corner === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
  }

  // What the front has unrolled so far: everything behind its torn edge,
  // which trails the scraps landing on it by about one scrap.
  const unrolledPart = (paper: Paper) => {
    const [ax, ay] = paper.anchor
    const nx = -paper.dirY
    const ny = paper.dirX
    const reach = paper.unrolled - paper.spacing
    const behind = Math.hypot(width, height) * 2
    const [from, to] = paper.across
    const steps = Math.min(paper.tear.length - 1, Math.max(8, Math.ceil((to - from) / (paper.spacing * 0.6))))
    const points: number[][] = []
    for (let i = 0; i <= steps; i += 1) {
      const side = from + ((to - from) * i) / steps
      const along = reach + paper.tear[i] * paper.spacing
      points.push([ax + paper.dirX * along + nx * side, ay + paper.dirY * along + ny * side])
    }
    points.push([ax - paper.dirX * behind + nx * to, ay - paper.dirY * behind + ny * to])
    points.push([ax - paper.dirX * behind + nx * from, ay - paper.dirY * behind + ny * from])
    return points
  }

  const draw = () => {
    frontContext.setTransform(1, 0, 0, 1, 0, 0)
    frontContext.clearRect(0, 0, front.width, front.height)
    backContext.setTransform(1, 0, 0, 1, 0, 0)
    backContext.clearRect(0, 0, back.width, back.height)
    drawMarkers()
    for (const index of order) {
      // Far scraps go behind, blurred; gathering pulls them forward.
      const isBack = scraps[index].level >= FIRST_BACK_LEVEL && blend[index] < 0.3
      drawScrap(index, isBack ? backContext : frontContext, isBack ? ratio * 0.5 : ratio, isBack ? 0 : 1, isBack ? 0 : 1)
    }
    // Each paper, inside its own outline: the part unrolled so far, and the
    // scraps landed in it, their torn rims melting into the sheet.
    papers.forEach((paper, paperIndex) => {
      if (formStart < 0 || clock < formStart || paper.reach === 0) return
      frontContext.save()
      frontContext.setTransform(ratio, 0, 0, ratio, 0, 0)
      tracePaper(frontContext, paper, paper.polygon)
      frontContext.clip()
      const sheet = Number.isFinite(paper.unrolled) ? unrolledPart(paper) : paper.polygon
      tracePaper(frontContext, paper, sheet)
      frontContext.globalAlpha = paper.exit.fade ? 1 - smoother(paper.out) : 1
      frontContext.fillStyle = paper.color
      frontContext.fill()
      frontContext.globalAlpha = 1
      for (const index of landedIn[paperIndex]) {
        const landedFor = clock - scraps[index].gatherAt - GATHER_SECONDS
        drawScrap(index, frontContext, ratio, 0, 1 - smoother(landedFor / MELT_SECONDS))
      }
      frontContext.restore()
    })
    // In flight, on top: its shadow closes in as it comes down onto the paper.
    for (const index of flying) drawScrap(index, frontContext, ratio, 1 - blend[index], 1)
  }

  const finish = () => {
    cleared = true
    cancelAnimationFrame(raf)
    frontContext.setTransform(1, 0, 0, 1, 0, 0)
    frontContext.clearRect(0, 0, front.width, front.height)
    backContext.setTransform(1, 0, 0, 1, 0, 0)
    backContext.clearRect(0, 0, back.width, back.height)
  }

  const frame = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60
    last = now
    clock += dt
    const rush = leaveAt < 0 ? 0 : smoother((clock - leaveAt) / LEAVE_SECONDS)
    const flow = speed * (1 + 20 * rush * rush)
    for (let level = 0; level < DEPTHS.length; level += 1) {
      travel[level] += dt * FLOW * flow * Math.sqrt(DEPTHS[0] / DEPTHS[level])
    }
    drift += dt * speed
    twist += dt * speed * 0.08
    pointer.presence += ((pointer.inside ? 1 : 0) - pointer.presence) * Math.min(1, dt * 4)
    const tx = pointer.inside ? pointer.x / Math.max(width, 1) : 0.5
    const ty = pointer.inside ? pointer.y / Math.max(height, 1) : 0.5
    pointer.px += (tx - pointer.px) * Math.min(1, dt * 3)
    pointer.py += (ty - pointer.py) * Math.min(1, dt * 3)
    place(dt)
    draw()
    if (formed && clock >= formedAt) {
      formed()
      formed = null
    }
    if (gone && clock >= goneAt) {
      gone()
      gone = null
      finish()
      return
    }
    if (leaveAt >= 0 && clock - leaveAt > LEAVE_SECONDS + 0.1) return
    raf = requestAnimationFrame(frame)
  }

  const gather = (targets: PaperTarget[]): PaperGathering => {
    if (reduced || cleared || gatherStart >= 0) return DONE
    gatherStart = clock
    // The first scraps leave the stream now, to land as the fronts set off.
    formStart = clock + GATHER_SECONDS
    formedAt = formStart + UNROLL_SECONDS
    goneAt = formedAt + PAPER_EXIT_SECONDS + Math.max(0, ...targets.map((target) => target.exit.delay))
    papers = targets.map((target) => {
      const length = Math.hypot(target.exit.x, target.exit.y)
      const tear = new Float32Array(65)
      for (let i = 0; i < tear.length; i += 1) tear[i] = next() - 0.5
      return {
        color: `rgb(${inks[INKS.indexOf(target.ink)].join(' ')})`,
        polygon: target.polygon,
        pivot: target.pivot,
        exit: target.exit,
        dirX: length ? target.exit.x / length : 1,
        dirY: length ? target.exit.y / length : 0,
        anchor: target.pivot,
        reach: 0,
        tear,
        bend: target.exit.x < 0 ? -1 : 1,
        spacing: 0,
        across: [0, 0],
        unrolled: 0,
        out: -PULL_BACK,
        cos: 1,
        sin: 0,
        dx: 0,
        dy: 0,
      }
    })
    landedIn = papers.map(() => [])
    // Scraps with no paper of their color shrink away meanwhile.
    for (const scrap of scraps) {
      scrap.paper = -1
      scrap.gatherAt = clock + scrap.arrive * UNROLL_SECONDS
    }
    // Each color's scraps, split among its papers by how much of each is on
    // screen. Spots and scraps both go in order along the paper's way out,
    // so the ones nearest the inner edge leave the stream first, and each
    // lands just as the front reaches its spot.
    INKS.forEach((name, inkIndex) => {
      const mine = scraps.flatMap((scrap, index) => (scrap.ink === inkIndex ? [{ scrap, x: screenX[index], y: screenY[index] }] : []))
      const chosen = papers.flatMap((paper, paperIndex) => (targets[paperIndex].ink === name ? [paperIndex] : []))
      if (chosen.length === 0 || mine.length === 0) return
      const areas = chosen.map((paperIndex) => slotsIn(papers[paperIndex].polygon, 1, width, height, next).spacing ** 2)
      const total = areas.reduce((sum, area) => sum + area, 0) || 1
      let taken = 0
      chosen.forEach((paperIndex, rankOfPaper) => {
        const paper = papers[paperIndex]
        const share =
          rankOfPaper === chosen.length - 1 ? mine.length - taken : Math.round((mine.length * areas[rankOfPaper]) / total)
        const along = (x: number, y: number) => x * paper.dirX + y * paper.dirY
        const group = mine.slice(taken, taken + share).sort((a, b) => along(a.x, a.y) - along(b.x, b.y))
        taken += share
        const { slots, spacing } = slotsIn(paper.polygon, group.length, width, height, next)
        if (slots.length === 0) return
        slots.sort((a, b) => along(a[0], a[1]) - along(b[0], b[1]))
        paper.anchor = slots[0]
        paper.spacing = spacing
        const start = along(slots[0][0], slots[0][1])
        paper.reach = along(slots[slots.length - 1][0], slots[slots.length - 1][1]) - start + spacing
        const side = (x: number, y: number) => (x - slots[0][0]) * -paper.dirY + (y - slots[0][1]) * paper.dirX
        const sides = slots.map(([x, y]) => side(x, y))
        paper.across = [Math.min(...sides) - spacing * 3, Math.max(...sides) + spacing * 3]
        const heading = Math.atan2(paper.dirY, paper.dirX)
        group.forEach(({ scrap }, rank) => {
          const slot = slots[Math.floor((rank * slots.length) / group.length)]
          scrap.paper = paperIndex
          scrap.slotX = slot[0]
          scrap.slotY = slot[1]
          // Lined up with the paper's way, give or take: laid down, not thrown.
          scrap.slotAngle = heading + (next() - 0.5) * 0.7
          // Torn scraps are narrow: big enough to overlap their neighbors.
          scrap.slotRadius = spacing * 1.3
          scrap.gatherAt = formStart + (UNROLL_SECONDS * (along(slot[0], slot[1]) - start)) / paper.reach - GATHER_SECONDS
        })
      })
    })
    return {
      formed: new Promise<void>((resolve) => {
        formed = resolve
      }),
      gone: new Promise<void>((resolve) => {
        gone = resolve
      }),
    }
  }

  const still = () => {
    clock = 2
    place(0)
    draw()
  }

  pointer.px = 0.5
  pointer.py = 0.5
  resize()

  const observer = new ResizeObserver(() => {
    resize()
    if (reduced) still()
  })
  observer.observe(container)

  const onPointerMove = (event: PointerEvent) => {
    const box = container.getBoundingClientRect()
    pointer.x = event.clientX - box.left
    pointer.y = event.clientY - box.top
    pointer.inside = true
  }
  const onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) pointer.inside = false
  }
  const onVisibility = () => {
    cancelAnimationFrame(raf)
    if (document.hidden || cleared) return
    last = 0
    raf = requestAnimationFrame(frame)
  }

  if (reduced) {
    still()
  } else {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerout', onPointerOut, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)
  }

  return {
    leave() {
      if (reduced || leaveAt >= 0) return
      leaveAt = clock
    },
    gather,
    dispose() {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

export function PaperShards({ ref, className, speed = 1 }: PaperShardsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef<ReturnType<typeof startPaperShards> | null>(null)
  const leaving = useRef(false)

  useImperativeHandle(ref, () => ({
    leave() {
      leaving.current = true
      engine.current?.leave()
    },
    gather: (targets) => engine.current?.gather(targets) ?? DONE,
  }), [])

  useEffect(() => {
    const container = containerRef.current
    const front = frontRef.current
    const back = backRef.current
    if (!container || !front || !back) return
    const started = startPaperShards(container, front, back, speed)
    engine.current = started
    if (leaving.current) started.leave()
    return () => {
      started.dispose()
      engine.current = null
    }
  }, [speed])

  return (
    <div ref={containerRef} aria-hidden="true" className={cn('pointer-events-none overflow-hidden', className)}>
      <canvas ref={backRef} className="absolute inset-0 block h-full w-full blur-[1px]" />
      <canvas ref={frontRef} className="absolute inset-0 block h-full w-full" />
    </div>
  )
}
