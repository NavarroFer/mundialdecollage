'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { galleryThemes, type GalleryTheme, type GalleryThemeDefinition } from '../themes'
import { skyTexture } from './architectureTextures'
import { DOOR_HEIGHT, DOOR_WIDTH, SKYLIGHT, WALL_HEIGHT, WALL_THICKNESS, doorways, rooms } from './roomsData'

// Classical museum trim (cornice with dentils, picture rail, chair rail over
// wainscot panels, door casings) and, when a theme turns it on, a glass
// ceiling in every room. It's
// decoration only, so it lives outside the physics colliders, and each
// material's pieces are merged into one mesh: a handful of draw calls total.

type Vec3 = [number, number, number]

/** One room-facing side of a wall. `axis` is the direction it runs along. */
type Side = { axis: 'x' | 'z'; at: number; from: number; to: number; normal: 1 | -1 }

const INSET = WALL_THICKNESS / 2
const CASING = 0.14
// Low enough to clear the name label under the tallest frames.
const CHAIR_RAIL = 0.4
const DOOR_HALF = DOOR_WIDTH / 2

function roomSides([minX, minZ, maxX, maxZ]: [number, number, number, number]): Side[] {
  return [
    { axis: 'x', at: minZ + INSET, from: minX + INSET, to: maxX - INSET, normal: 1 },
    { axis: 'x', at: maxZ - INSET, from: minX + INSET, to: maxX - INSET, normal: -1 },
    { axis: 'z', at: minX + INSET, from: minZ + INSET, to: maxZ - INSET, normal: 1 },
    { axis: 'z', at: maxX - INSET, from: minZ + INSET, to: maxZ - INSET, normal: -1 },
  ]
}

/** The stretches of a side below door height, with each doorway and its casing cut out. */
function lowerRuns(side: Side): [number, number, boolean, boolean][] {
  const gaps = doorways
    .filter((door) => door.axis === side.axis && Math.abs((side.axis === 'z' ? door.center[0] : door.center[2]) - side.at) <= INSET + 0.001)
    .map((door) => (side.axis === 'z' ? door.center[2] : door.center[0]))
    .sort((a, b) => a - b)
  const runs: [number, number, boolean, boolean][] = []
  let start = side.from
  let startsAtCorner = true
  for (const center of gaps) {
    runs.push([start, center - DOOR_HALF - CASING, startsAtCorner, false])
    start = center + DOOR_HALF + CASING
    startsAtCorner = false
  }
  runs.push([start, side.to, startsAtCorner, true])
  return runs
}

class Builder {
  parts: THREE.BufferGeometry[] = []

  box(center: Vec3, size: Vec3) {
    const geometry = new THREE.BoxGeometry(...size)
    geometry.translate(...center)
    this.parts.push(geometry)
  }

  /**
   * A strip along a side at height `y`, sticking out `depth` from the wall.
   * Where two sides meet in a corner, strips along X run through it and
   * strips along Z stop short, so no two faces overlap and flicker.
   */
  strip(side: Side, y: number, height: number, depth: number, from = side.from, to = side.to, corners: [boolean, boolean] = [true, true]) {
    const grow = side.axis === 'x' ? depth : -depth
    const a = from - (corners[0] ? grow : 0)
    const b = to + (corners[1] ? grow : 0)
    if (b - a <= 0.01) return
    const out = side.at + side.normal * depth / 2
    if (side.axis === 'x') this.box([(a + b) / 2, y, out], [b - a, height, depth])
    else this.box([out, y, (a + b) / 2], [depth, height, b - a])
  }

  /** Small blocks in a row, like the dentils under a cornice. */
  row(side: Side, y: number, size: number, depth: number, spacing: number) {
    const margin = 0.2
    const count = Math.floor((side.to - side.from - margin * 2) / spacing)
    const start = (side.from + side.to) / 2 - (count - 1) * spacing / 2
    const out = side.at + side.normal * depth / 2
    for (let i = 0; i < count; i++) {
      const along = start + i * spacing
      if (side.axis === 'x') this.box([along, y, out], [size, size, depth])
      else this.box([out, y, along], [depth, size, size])
    }
  }

  merge() {
    const merged = mergeGeometries(this.parts)
    for (const part of this.parts) part.dispose()
    return merged
  }
}

function buildMolding() {
  const b = new Builder()
  for (const room of rooms) {
    for (const side of roomSides(room.bounds)) {
      // Cornice, bottom to top: frieze, bed molding, dentils, fillet, crown.
      b.strip(side, 3.36, 0.2, 0.025)
      b.strip(side, 3.475, 0.03, 0.05)
      b.row(side, 3.515, 0.05, 0.075, 0.1)
      b.strip(side, 3.55, 0.02, 0.09)
      b.strip(side, 3.58, 0.04, 0.13)
      // Picture rail just above the tallest frames.
      b.strip(side, 3.08, 0.035, 0.022)

      for (const [from, to, startCorner, endCorner] of lowerRuns(side)) {
        b.strip(side, CHAIR_RAIL, 0.04, 0.03, from, to, [startCorner, endCorner])
        b.strip(side, CHAIR_RAIL - 0.027, 0.014, 0.019, from, to, [startCorner, endCorner])
        wainscot(b, side, from + (startCorner ? 0.06 : 0), to - (endCorner ? 0.06 : 0))
      }
    }
  }
  for (const door of doorways) doorCasing(b, door.center)
  return b.merge()
}

/** Raised rectangles between the baseboard and the chair rail. */
function wainscot(b: Builder, side: Side, from: number, to: number) {
  const length = to - from
  const gap = 0.16
  const count = Math.max(1, Math.round(length / 1.1))
  const width = (length - gap * (count + 1)) / count
  if (width < 0.3) return
  const [bottom, top, bar, depth] = [0.2, CHAIR_RAIL - 0.07, 0.022, 0.012]
  for (let i = 0; i < count; i++) {
    const a = from + gap + i * (width + gap)
    const panel: Side = { ...side, from: a, to: a + width }
    b.strip(panel, bottom, bar, depth, a, a + width, [false, false])
    b.strip(panel, top, bar, depth, a, a + width, [false, false])
    b.strip(panel, (bottom + top) / 2, top - bottom - bar, depth, a, a + bar, [false, false])
    b.strip(panel, (bottom + top) / 2, top - bottom - bar, depth, a + width - bar, a + width, [false, false])
  }
}

/** Architrave around a doorway on both faces, crowned with a small cornice. */
function doorCasing(b: Builder, [x, , z]: Vec3) {
  for (const normal of [1, -1] as const) {
    const face = x + normal * INSET
    const out = (depth: number) => face + normal * depth / 2
    const top = DOOR_HEIGHT + CASING
    for (const edge of [-1, 1]) b.box([out(0.035), top / 2, z + edge * (DOOR_HALF + CASING / 2)], [0.035, top, CASING])
    b.box([out(0.035), DOOR_HEIGHT + CASING / 2, z], [0.035, CASING, DOOR_WIDTH])
    b.box([out(0.02), top + 0.09, z], [0.02, 0.18, DOOR_WIDTH + CASING * 2 + 0.1])
    b.box([out(0.09), top + 0.21, z], [0.09, 0.06, DOOR_WIDTH + CASING * 2 + 0.3])
  }
}

function buildSkylights() {
  const trim = new Builder()
  const well = new Builder()
  const mullions = new Builder()
  const glass: THREE.BufferGeometry[] = []
  const fixtures: THREE.BufferGeometry[] = []
  const lenses: THREE.BufferGeometry[] = []
  const { width, depth, well: rise } = SKYLIGHT
  const glassY = WALL_HEIGHT + rise

  for (const room of rooms) {
    const cx = (room.bounds[0] + room.bounds[2]) / 2
    // A deep frame around the opening, hanging just below the ceiling.
    const t = 0.18
    trim.box([cx, WALL_HEIGHT - 0.06, -depth / 2 - t / 2], [width + t * 2, 0.12, t])
    trim.box([cx, WALL_HEIGHT - 0.06, depth / 2 + t / 2], [width + t * 2, 0.12, t])
    trim.box([cx - width / 2 - t / 2, WALL_HEIGHT - 0.06, 0], [t, 0.12, depth])
    trim.box([cx + width / 2 + t / 2, WALL_HEIGHT - 0.06, 0], [t, 0.12, depth])
    // The shaft up to the glass.
    well.box([cx, WALL_HEIGHT + rise / 2, -depth / 2 - 0.01], [width, rise, 0.02])
    well.box([cx, WALL_HEIGHT + rise / 2, depth / 2 + 0.01], [width, rise, 0.02])
    well.box([cx - width / 2 - 0.01, WALL_HEIGHT + rise / 2, 0], [0.02, rise, depth])
    well.box([cx + width / 2 + 0.01, WALL_HEIGHT + rise / 2, 0], [0.02, rise, depth])

    const pane = new THREE.PlaneGeometry(width, depth)
    pane.rotateX(Math.PI / 2)
    pane.translate(cx, glassY, 0)
    glass.push(pane)

    // Muntins every ~0.95 m, like the grid of a real skylight.
    const columns = Math.round(width / 0.95)
    const rows = Math.round(depth / 0.95)
    for (let i = 1; i < columns; i++) mullions.box([cx - width / 2 + (i * width) / columns, glassY - 0.03, 0], [0.035, 0.06, depth])
    for (let j = 1; j < rows; j++) mullions.box([cx, glassY - 0.03, -depth / 2 + (j * depth) / rows], [width, 0.06, 0.035])

    // Two tracks of spotlights along the glass, aimed at the long walls.
    for (const side of [-1, 1]) {
      const z = side * (depth / 2 - 0.55)
      const rail = new THREE.BoxGeometry(width - 0.6, 0.035, 0.05)
      rail.translate(cx, glassY - 0.1, z)
      fixtures.push(rail)
      const spots = Math.round((width - 1) / 0.8)
      for (let i = 0; i < spots; i++) {
        const x = cx - (width - 1) / 2 + (i * (width - 1)) / (spots - 1)
        const aim = new THREE.Matrix4().makeRotationX(-side * 0.65)
        const place = new THREE.Matrix4().makeTranslation(x, glassY - 0.14, z)
        const stem = new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).translate(0, 0.02, 0)
        const can = new THREE.CylinderGeometry(0.038, 0.045, 0.14, 10).translate(0, -0.07, 0)
        const lens = new THREE.CircleGeometry(0.036, 10).rotateX(Math.PI / 2).translate(0, -0.141, 0)
        for (const part of [stem, can]) fixtures.push(part.applyMatrix4(aim).applyMatrix4(place))
        lenses.push(lens.applyMatrix4(aim).applyMatrix4(place))
      }
    }
  }
  const merged = (parts: THREE.BufferGeometry[]) => {
    const result = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)))
    for (const part of parts) part.dispose()
    return result
  }
  return { trim: trim.merge(), well: well.merge(), mullions: mullions.merge(), glass: merged(glass), fixtures: merged(fixtures), lenses: merged(lenses) }
}

export function Architecture({ theme }: { theme: GalleryTheme }) {
  const palette = galleryThemes[theme].architecture
  const molding = useMemo(() => buildMolding(), [])
  if (!palette) return null
  return (
    <group>
      <mesh geometry={molding}>
        <meshStandardMaterial color={palette.molding} roughness={0.7} />
      </mesh>
      {palette.skylight && <Skylights palette={palette} />}
    </group>
  )
}

function Skylights({ palette }: { palette: NonNullable<GalleryThemeDefinition['architecture']> }) {
  const skylights = useMemo(() => buildSkylights(), [])
  const sky = useMemo(() => skyTexture(palette.sky), [palette.sky])
  return (
    <group>
      <mesh geometry={skylights.trim}>
        <meshStandardMaterial color={palette.molding} roughness={0.7} />
      </mesh>
      <mesh geometry={skylights.well}>
        <meshStandardMaterial color={palette.well} roughness={0.9} />
      </mesh>
      <mesh geometry={skylights.glass}>
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      <mesh geometry={skylights.mullions}>
        <meshStandardMaterial color={palette.mullion} roughness={0.6} />
      </mesh>
      <mesh geometry={skylights.fixtures}>
        <meshStandardMaterial color={palette.fixture} roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh geometry={skylights.lenses}>
        <meshBasicMaterial color="#fff3d4" toneMapped={false} />
      </mesh>
    </group>
  )
}
