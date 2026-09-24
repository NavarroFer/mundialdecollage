'use client'

import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GalleryTheme } from '../../themes'
import { loft, type LoftOptions, type Ring } from './loft'
import { LOOKS, type ArmPose, type Build, type Look } from './looks'

export const LOOK_COUNT = LOOKS.length

/** Which of the looks (outfit + build) and the accent color. */
export type Appearance = { look: number; shirt: string }

/** What a person's driver decided this frame; Person animates the rest. */
export type Motion = { moving: boolean; facing: number; step: number }

// Every person shares these: geometry by shape, materials by color. Nothing is
// disposed because the set is small and fixed.
const geometries = new Map<string, THREE.BufferGeometry>()
const materials = new Map<string, THREE.Material>()

function shape(key: string, make: () => THREE.BufferGeometry) {
  let geometry = geometries.get(key)
  if (!geometry) geometries.set(key, geometry = make())
  return geometry
}

const lofted = (key: string, rings: readonly Ring[], options?: LoftOptions) => shape(key, () => loft(rings, options))
const box = (w: number, h: number, d: number) => shape(`box ${w} ${h} ${d}`, () => new THREE.BoxGeometry(w, h, d))

function stripeTexture(color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 4
  const context = canvas.getContext('2d')!
  context.fillStyle = color
  context.fillRect(0, 0, 64, 4)
  context.fillStyle = `#${new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.7).getHexString()}`
  for (let x = 0; x < 64; x += 16) context.fillRect(x, 0, 3, 4)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.set(3, 1)
  return texture
}

/** Matte and flat-shaded, so each facet catches the light on its own. */
function paint(color: string, { double = false, stripes = false } = {}) {
  const key = `${color} ${double} ${stripes}`
  let material = materials.get(key)
  if (!material) {
    materials.set(key, material = new THREE.MeshStandardMaterial({
      color: stripes ? '#ffffff' : color,
      map: stripes ? stripeTexture(color) : null,
      flatShading: true,
      roughness: 0.9,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    }))
  }
  return material
}

type PartProps = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  shadow?: boolean
}

function Part({ geometry, material, shadow = false, ...transform }: PartProps) {
  return <mesh geometry={geometry} material={material} castShadow={shadow} {...transform} />
}

// Body landmarks in meters, for a figure of height 1 (about 1.73 m).
const HIP_Y = 0.86
const THIGH = 0.4
const SHIN = 0.38
const ANKLE_TO_GROUND = 0.08
const SHOULDER_Y = 1.395
const UPPER_ARM = 0.29
const FOREARM = 0.25
const HEAD_Y = 1.615
// A touch bigger than life, like the illustrated figures this style comes from.
const HEAD_SCALE = 1.08

type BuildShape = { armX: number; hipX: number; arm: number; torso: Ring[]; pelvis: Ring[]; head: Ring[] }

const BUILDS: Record<Build, BuildShape> = {
  m: {
    armX: 0.195, hipX: 0.088, arm: 1,
    torso: [[0.93, 0.168, 0.112], [1.05, 0.162, 0.106], [1.2, 0.176, 0.116, 0.005], [1.33, 0.19, 0.12, 0.005], [1.4, 0.19, 0.11], [1.44, 0.15, 0.09], [1.47, 0.09, 0.066], [1.485, 0.05, 0.05]],
    pelvis: [[0.79, 0.11, 0.08], [0.86, 0.158, 0.1], [0.96, 0.165, 0.103], [1, 0.16, 0.1]],
    head: [[-0.118, 0.03, 0.028, 0.048], [-0.1, 0.052, 0.055, 0.034], [-0.065, 0.07, 0.08, 0.014], [-0.015, 0.079, 0.093, 0.002], [0.035, 0.081, 0.096, -0.003], [0.08, 0.074, 0.088, -0.008], [0.115, 0.048, 0.058, -0.012], [0.128, 0.018, 0.022, -0.014]],
  },
  f: {
    armX: 0.172, hipX: 0.09, arm: 0.88,
    torso: [[0.93, 0.155, 0.105], [1.04, 0.132, 0.09], [1.17, 0.148, 0.108, 0.01], [1.3, 0.158, 0.118, 0.018], [1.385, 0.165, 0.1], [1.43, 0.13, 0.082], [1.465, 0.08, 0.06], [1.48, 0.045, 0.045]],
    pelvis: [[0.79, 0.12, 0.085], [0.87, 0.176, 0.108], [0.96, 0.165, 0.1], [1, 0.14, 0.092]],
    head: [[-0.115, 0.024, 0.024, 0.046], [-0.098, 0.047, 0.052, 0.032], [-0.065, 0.065, 0.078, 0.014], [-0.015, 0.076, 0.091, 0.002], [0.035, 0.078, 0.094, -0.003], [0.08, 0.072, 0.087, -0.008], [0.115, 0.047, 0.057, -0.012], [0.128, 0.018, 0.022, -0.014]],
  },
}

const CHEST_RING = 3
const TORSO_OPTIONS = { segments: 8, offset: Math.PI / 8 }

// Open layers follow the torso a little further out, flaring below the waist.
const OUTER_HEMS: Record<NonNullable<Look['outer']>['kind'], { gap: number; inflate: number; hem: Ring[] }> = {
  trench: { gap: 0.35, inflate: 0.026, hem: [[0.44, 0.28, 0.22], [0.72, 0.232, 0.172], [0.9, 0.205, 0.148]] },
  shirt: { gap: 0.42, inflate: 0.016, hem: [[0.88, 0.182, 0.124]] },
  jacket: { gap: 0.3, inflate: 0.026, hem: [[0.98, 0.188, 0.13]] },
  cardigan: { gap: 0.38, inflate: 0.02, hem: [[0.82, 0.19, 0.13]] },
}

const SKIRT: Ring[] = [[0.52, 0.23, 0.19], [0.75, 0.2, 0.155], [0.93, 0.172, 0.115], [1.02, 0.15, 0.1]]
const DRESS: Ring[] = [[0.56, 0.21, 0.17], [0.8, 0.19, 0.145], [0.94, 0.17, 0.114], [1.02, 0.15, 0.1]]

const frontness = (angle: number) => Math.max(0, Math.cos(angle)) ** 2
const backness = (angle: number) => Math.max(0, -Math.cos(angle))

// Short hair everywhere starts as this shell over the skull, cut higher at the
// forehead and lower at the nape.
const HAIR_CAP: Ring[] = [[-0.03, 0.087, 0.099, -0.008], [0.03, 0.089, 0.103, -0.006], [0.085, 0.08, 0.093, -0.01], [0.12, 0.052, 0.062, -0.014], [0.137, 0.016, 0.02, -0.016]]
const hairline = (fringe: number) => (angle: number, ring: number) =>
  ring === 0 ? fringe * frontness(angle) - 0.04 * backness(angle) : ring === 1 ? fringe * 0.55 * frontness(angle) : 0

const HAIR_FALL: Record<'long' | 'wavy' | 'bob', Ring[]> = {
  long: [[-0.26, 0.122, 0.07, -0.05], [-0.17, 0.116, 0.08, -0.035], [-0.08, 0.102, 0.098, -0.015], [0, 0.094, 0.106, -0.008], [0.07, 0.086, 0.1, -0.01]],
  wavy: [[-0.24, 0.13, 0.075, -0.045], [-0.16, 0.122, 0.085, -0.03], [-0.07, 0.106, 0.1, -0.012], [0, 0.096, 0.107, -0.008], [0.07, 0.087, 0.1, -0.01]],
  bob: [[-0.085, 0.104, 0.1, -0.01], [-0.02, 0.1, 0.106, -0.008], [0.06, 0.09, 0.1, -0.01]],
}

const BEARD: Ring[] = [[-0.126, 0.034, 0.034, 0.052], [-0.1, 0.058, 0.062, 0.036], [-0.065, 0.076, 0.086, 0.015], [-0.015, 0.085, 0.099, 0.002], [0.02, 0.086, 0.1, 0]]

const themeSkin: Record<GalleryTheme, string | null> = { collage: null, windows98: '#ffff00', garden: null }

function armPoses(look: Look): [ArmPose, ArmPose] {
  // Index 0 is the person's right side (-X when facing +Z), 1 their left.
  return [look.cup ? 'cup' : look.bag ? 'strap' : 'swing', look.pocket ? 'pocket' : 'swing']
}

type PersonProps = {
  appearance: Appearance
  theme: GalleryTheme
  start: [number, number]
  /** Offsets idle head sway so people don't move in lockstep. */
  phase?: number
  /** A small marker overhead: this is a real visitor, not a scripted one. */
  marker?: boolean
  /** Moves the root group's x/z (and may hide it); called every frame. */
  move: (person: THREE.Group, delta: number) => Motion
}

export function Person({ appearance, theme, start, phase = 0, marker = false, move }: PersonProps) {
  const root = useRef<THREE.Group>(null)
  const chest = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const shoulders = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elbows = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const hips = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const knees = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elapsed = useRef(phase)
  const gait = useRef(0)

  const look = LOOKS[appearance.look % LOOKS.length]
  const build = BUILDS[look.build]
  const poses = armPoses(look)

  useFrame((_, frameDelta) => {
    const person = root.current
    if (!person) return
    const delta = Math.min(frameDelta, 0.05)
    elapsed.current += delta
    const { moving, facing, step } = move(person, delta)
    gait.current += step * 8.5
    const g = gait.current

    // Always take the shortest turn, including across the -PI / PI boundary.
    const turn = Math.atan2(Math.sin(facing - person.rotation.y), Math.cos(facing - person.rotation.y))
    person.rotation.y += turn * (1 - Math.exp(-6 * delta))
    const stride = moving ? Math.sin(g) * 0.34 : 0
    const damp = (object: THREE.Object3D | null, axis: 'x' | 'y' | 'z', target: number, lambda = 10) => {
      if (object) object.rotation[axis] = THREE.MathUtils.damp(object.rotation[axis], target, lambda, delta)
    }

    ;[-1, 1].forEach((side, i) => {
      // A leg bends its knee while it swings forward, and stays almost straight while it carries weight.
      damp(hips[i].current, 'x', side * stride)
      damp(knees[i].current, 'x', moving ? 0.05 + Math.max(0, -side * Math.cos(g)) * 0.8 : 0.03)
      // Arms swing against the leg on the same side, unless the hand is busy.
      const swing = -side * stride * 0.8
      const pose = poses[i]
      const shoulder = pose === 'cup' ? -0.06 + swing * 0.15 : pose === 'pocket' ? 0.1 : pose === 'strap' ? swing * 0.25 : swing
      const elbow = pose === 'cup' ? -1.45 : pose === 'pocket' ? -0.35 : pose === 'strap' ? -0.3 : -0.12 - Math.max(0, -swing) * 0.9
      const spread = pose === 'strap' ? 0.2 : pose === 'pocket' ? 0.02 : 0.06
      damp(shoulders[i].current, 'x', shoulder)
      damp(shoulders[i].current, 'z', side * spread)
      damp(elbows[i].current, 'x', elbow)
    })
    damp(chest.current, 'y', moving ? Math.sin(g) * 0.07 : 0, 6)
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, moving ? 0 : Math.sin(elapsed.current * 0.55) * 0.18, 4, delta)
      head.current.rotation.z = Math.sin(elapsed.current * 0.7) * 0.025
    }
    person.position.y = THREE.MathUtils.damp(person.position.y, moving ? Math.abs(Math.sin(g)) * 0.016 : 0, 10, delta)
  })

  const skin = themeSkin[theme] ?? look.skin
  const accent = appearance.shirt
  const topColor = look.top.color ?? accent
  const bottomColor = look.bottom.color ?? accent
  const outerColor = look.outer ? look.outer.color ?? accent : null
  const skirted = look.bottom.kind === 'skirt' || look.bottom.kind === 'dress'
  const legColor = skirted ? skin : bottomColor
  const sleeveColor = outerColor ?? (look.top.kind === 'camisole' ? skin : topColor)
  const sleeveStripes = Boolean(look.outer?.stripes)
  const hairMaterial = paint(look.hairColor)
  const skinMaterial = paint(skin)

  // Split at the chest ring, so a camisole can leave the collarbones bare.
  const lowerTorso = build.torso.slice(0, CHEST_RING + 1)
  const upperTorso = build.torso.slice(CHEST_RING)
  const torsoKey = `torso ${look.build}`

  function outerLayer() {
    if (!look.outer || !outerColor) return null
    const kind = look.outer.kind
    const { gap, inflate, hem } = OUTER_HEMS[kind]
    const rings: Ring[] = [
      ...hem,
      ...build.torso.slice(1, -1).map(([y, rx, rz, z = 0]) => [y, rx + inflate, rz + inflate, z] as Ring),
    ]
    const material = paint(outerColor, { double: true, stripes: look.outer.stripes })
    const front = build.torso[3]
    return (
      <>
        <Part geometry={lofted(`${kind} ${look.build}`, rings, { segments: 14, arc: [gap, Math.PI * 2 - gap] })} material={material} shadow />
        {/* The collar stands open at the front like the coat below it. */}
        <Part geometry={lofted('collar', [[1.43, 0.11, 0.08, -0.004], [1.5, 0.08, 0.066, -0.01]], { segments: 10, arc: [0.55, Math.PI * 2 - 0.55] })} material={material} />
        {kind === 'trench' && [-1, 1].map((side) => (
          // Lapels folding back from the opening.
          <Part key={side} geometry={box(0.04, 0.14, 0.008)} material={material}
            position={[side * 0.085, 1.345, front[2] + (front[3] ?? 0) + inflate - 0.01]} rotation={[-0.15, side * 0.4, -side * 0.25]} />
        ))}
        {kind === 'trench' && [1.2, 1.02, 0.84].map((y) => (
          <Part key={y} geometry={box(0.018, 0.018, 0.01)} material={paint('#6a4a2c')} position={[-0.09, y, y > 1 ? 0.13 : 0.155]} rotation={[0, -0.4, 0]} />
        ))}
        {kind === 'trench' && (
          <Part geometry={lofted('belt loop', [[1.02, 0.172, 0.13, 0.008], [1.06, 0.168, 0.126, 0.008]], { segments: 14, arc: [0.5, Math.PI * 2 - 0.5] })} material={paint(outerColor, { double: true })} />
        )}
      </>
    )
  }

  function arm(side: -1 | 1, index: number) {
    const pose = poses[index]
    const long = look.sleeves === 'long'
    const sleeve = paint(sleeveColor, { stripes: sleeveStripes })
    return (
      <group key={side} ref={shoulders[index]} position={[side * build.armX, SHOULDER_Y, 0]}>
        <Part geometry={lofted('upper arm', [[-UPPER_ARM, 0.036, 0.038], [-0.2, 0.042, 0.044], [-0.05, 0.05, 0.05], [0, 0.045, 0.046], [0.028, 0.028, 0.03]])}
          material={long ? sleeve : skinMaterial} scale={[build.arm, 1, build.arm]} shadow />
        {!long && look.top.kind !== 'camisole' && (
          <Part geometry={lofted('short sleeve', [[-0.15, 0.053, 0.055], [-0.02, 0.056, 0.057], [0.012, 0.05, 0.051], [0.036, 0.032, 0.034]])} material={sleeve} scale={[build.arm, 1, build.arm]} />
        )}
        <group ref={elbows[index]} position={[0, -UPPER_ARM, 0]}>
          <Part geometry={lofted('forearm', [[-FOREARM, 0.026, 0.029], [-0.2, 0.03, 0.033], [-0.06, 0.04, 0.041], [0.01, 0.037, 0.039]])}
            material={long ? sleeve : skinMaterial} scale={[build.arm, 1, build.arm]} shadow />
          {long && <Part geometry={lofted('cuff', [[-0.24, 0.034, 0.037], [-0.19, 0.035, 0.038]])} material={sleeve} scale={[build.arm, 1, build.arm]} />}
          {pose !== 'pocket' && (
            <group position={[0, -FOREARM, 0]}>
              <Part geometry={lofted('hand', [[-0.095, 0.011, 0.022, 0.004], [-0.07, 0.016, 0.034], [-0.03, 0.018, 0.038], [0.005, 0.014, 0.028]], { segments: 6 })} material={skinMaterial} />
              <Part geometry={box(0.013, 0.042, 0.014)} material={skinMaterial} position={[-side * 0.008, -0.04, 0.032]} rotation={[0.35, 0, 0]} />
              {pose === 'cup' && (
                <group position={[-side * 0.04, -0.05, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                  <Part geometry={lofted('cup', [[-0.05, 0.024, 0.024], [0.035, 0.031, 0.031]], { segments: 10 })} material={paint('#c59a68')} />
                  <Part geometry={lofted('lid', [[0.034, 0.033, 0.033], [0.048, 0.031, 0.031], [0.054, 0.022, 0.022]], { segments: 10 })} material={paint('#1c1b1a')} />
                </group>
              )}
            </group>
          )}
        </group>
      </group>
    )
  }

  function leg(side: -1 | 1, index: number) {
    const material = paint(legColor)
    const wide = look.bottom.kind === 'wide'
    return (
      <group key={side} ref={hips[index]} position={[side * build.hipX, HIP_Y, 0]}>
        <Part geometry={lofted('thigh', [[-THIGH, 0.052, 0.056], [-0.3, 0.06, 0.064], [-0.1, 0.074, 0.078], [0.04, 0.078, 0.08]])} material={material} shadow />
        <group ref={knees[index]} position={[0, -THIGH, 0]}>
          <Part geometry={wide
            ? lofted('wide shin', [[-SHIN, 0.062, 0.066], [0.02, 0.058, 0.062]])
            : lofted('shin', [[-SHIN, 0.033, 0.036], [-0.3, 0.04, 0.045], [-0.14, 0.05, 0.056, -0.005], [0.02, 0.052, 0.056]])} material={material} shadow />
          {/* Cuffed hems, like rolled-up trousers. */}
          {wide && <Part geometry={lofted('turn-up', [[-SHIN - 0.005, 0.068, 0.072], [-SHIN + 0.075, 0.067, 0.071]])} material={material} />}
          <group position={[0, -SHIN - ANKLE_TO_GROUND, 0]}>{shoe()}</group>
        </group>
      </group>
    )
  }

  function shoe() {
    const { kind, color, sole } = look.shoes
    const upper = paint(color)
    const soleMaterial = paint(sole)
    // Lofted heel to toe: rotated so the loft's axis runs forward, flat along the bottom.
    const along = (rings: [number, number, number][], bottom: number): Ring[] => rings.map(([y, rx, rz]) => [y, rx, rz, -bottom - rz])
    const lying: [number, number, number] = [Math.PI / 2, 0, 0]
    if (kind === 'sandals') {
      return (
        <>
          <Part geometry={lofted('foot', along([[-0.06, 0.03, 0.03], [0.02, 0.038, 0.028], [0.12, 0.042, 0.016], [0.16, 0.03, 0.01]], 0.04))} material={skinMaterial} rotation={lying} />
          <Part geometry={box(0.085, 0.014, 0.23)} material={soleMaterial} position={[0, 0.033, 0.045]} />
          <Part geometry={box(0.06, 0.03, 0.06)} material={soleMaterial} position={[0, 0.013, -0.05]} />
          <Part geometry={box(0.09, 0.022, 0.03)} material={upper} position={[0, 0.056, 0.11]} />
          <Part geometry={shape('ankle strap', () => new THREE.TorusGeometry(0.036, 0.007, 4, 8))} material={upper} position={[0, 0.095, -0.012]} rotation={[Math.PI / 2, 0, 0]} />
        </>
      )
    }
    const sneakers = kind === 'sneakers'
    const soleHeight = sneakers ? 0.03 : 0.016
    return (
      <>
        <Part geometry={lofted(`upper ${kind}`, along(sneakers
          ? [[-0.075, 0.04, 0.036], [-0.04, 0.047, 0.045], [0.04, 0.05, 0.036], [0.12, 0.048, 0.028], [0.17, 0.034, 0.018]]
          : [[-0.07, 0.038, 0.034], [-0.03, 0.044, 0.04], [0.05, 0.046, 0.03], [0.13, 0.042, 0.02], [0.17, 0.026, 0.012]], soleHeight - 0.004), { segments: 8 })}
          material={upper} rotation={lying} shadow />
        <Part geometry={box(sneakers ? 0.1 : 0.09, soleHeight, 0.255)} material={soleMaterial} position={[0, soleHeight / 2, 0.05]} />
        {kind === 'boots' && <Part geometry={lofted('boot shaft', [[0.05, 0.047, 0.05], [0.22, 0.044, 0.047]])} material={upper} />}
      </>
    )
  }

  function hair() {
    const style = look.hair
    const fringe = style === 'bob' ? 0.06 : style === 'short' || style === 'crop' ? 0.1 : 0.085
    const jitter = style === 'curly' ? 0.12 : style === 'wavy' ? 0.05 : 0.025
    return (
      <>
        <Part geometry={lofted(`hair cap ${style}`, HAIR_CAP, { segments: 10, jitter, lift: hairline(fringe) })}
          material={paint(look.hairColor, { double: true })} scale={style === 'curly' ? [1.12, 1.1, 1.1] : 1} shadow />
        {(style === 'long' || style === 'wavy' || style === 'bob') && (
          <Part geometry={lofted(`hair fall ${style}`, HAIR_FALL[style], { segments: 12, arc: [0.3 * Math.PI, 1.7 * Math.PI], jitter: style === 'wavy' ? 0.1 : 0.03 })}
            material={paint(look.hairColor, { double: true })} shadow />
        )}
        {style === 'bun' && <Part geometry={shape('bun', () => new THREE.IcosahedronGeometry(0.05, 0))} material={hairMaterial} position={[0, 0.1, -0.1]} />}
        {style === 'curly' && [[-0.06, 0.12, 0.03], [0.05, 0.13, 0.01], [0, 0.1, -0.08], [-0.08, 0.05, -0.06], [0.08, 0.06, -0.05]].map((p) => (
          <Part key={p.join()} geometry={shape('curl', () => new THREE.IcosahedronGeometry(0.042, 0))} material={hairMaterial} position={p as [number, number, number]} />
        ))}
      </>
    )
  }

  function glasses() {
    if (!look.glasses) return null
    const sun = look.glasses === 'sun'
    const frame = paint(sun ? '#f3f0e9' : look.glasses === 'round' ? '#6d5b44' : '#161616')
    const rim = sun
      ? shape('rim sun', () => new THREE.TorusGeometry(0.024, 0.0065, 4, 8))
      : look.glasses === 'round'
        ? shape('rim round', () => new THREE.TorusGeometry(0.019, 0.0035, 4, 10))
        : shape('rim thick', () => new THREE.TorusGeometry(0.021, 0.0055, 4, 4))
    return (
      <>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.035, 0.014, 0.094]} rotation={[0, side * 0.28, 0]}>
            {/* Four-sided rims turned 45° become square frames, stretched a little wider. */}
            <group scale={look.glasses === 'thick' ? [1.2, 0.9, 1] : 1}>
              <Part geometry={rim} material={frame} rotation={[0, 0, look.glasses === 'thick' ? Math.PI / 4 : Math.PI / 8]} />
            </group>
            {sun && <Part geometry={shape('lens', () => new THREE.CircleGeometry(0.022, 8))} material={paint('#1d1a18')} position={[0, 0, -0.002]} rotation={[0, 0, Math.PI / 8]} />}
            <Part geometry={box(0.004, 0.006, 0.09)} material={frame} position={[side * 0.04, 0.004, -0.05]} rotation={[0, -side * 0.28, 0]} />
          </group>
        ))}
        <Part geometry={box(0.02, 0.006, 0.006)} material={frame} position={[0, 0.02, 0.1]} />
      </>
    )
  }

  function face() {
    const beard = look.beard
    return (
      <>
        {[-1, 1].map((side) => (
          <group key={side}>
            {!(look.glasses === 'sun') && <Part geometry={box(0.017, 0.009, 0.006)} material={paint('#2b211c')} position={[side * 0.033, 0.012, 0.084]} rotation={[0, side * 0.33, 0]} />}
            <Part geometry={box(0.028, 0.007, 0.008)} material={hairMaterial} position={[side * 0.034, 0.037, 0.087]} rotation={[0, side * 0.33, -side * 0.1]} />
            <Part geometry={box(0.016, 0.042, 0.03)} material={skinMaterial} position={[side * 0.08, 0, -0.004]} />
          </group>
        ))}
        <Part geometry={shape('nose', () => new THREE.ConeGeometry(0.016, 0.046, 3))} material={skinMaterial} position={[0, -0.01, 0.086]} />
        {beard && (
          <>
            <Part geometry={lofted('beard', BEARD, { segments: 12, arc: [-0.56 * Math.PI, 0.56 * Math.PI], jitter: 0.02, lift: (angle, ring) => (ring === 4 ? -0.05 : ring === 3 ? -0.03 : 0) * Math.max(0, Math.cos(angle)) ** 0.6 })}
              material={paint(beard, { double: true })} />
          </>
        )}
        <Part geometry={box(0.032, 0.006, 0.006)} material={paint('#98584a')} position={[0, -0.058, beard ? 0.105 : 0.091]} />
      </>
    )
  }

  function cap(): ReactNode {
    if (!look.cap) return null
    const material = paint(look.cap)
    return (
      <>
        <Part geometry={lofted('cap crown', [[0.035, 0.093, 0.105, -0.006], [0.08, 0.091, 0.101, -0.008], [0.118, 0.067, 0.077, -0.012], [0.142, 0.024, 0.028, -0.014]], { segments: 10, lift: (angle, ring) => (ring === 0 ? 0.012 * frontness(angle) : 0) })}
          material={material} shadow />
        {/* Half a disc: the visor curves around the forehead. */}
        <Part geometry={shape('visor', () => new THREE.CylinderGeometry(0.09, 0.09, 0.01, 7, 1, false, -Math.PI / 2, Math.PI))} material={material}
          position={[0, 0.05, 0.075]} rotation={[0.14, 0, 0]} scale={[0.95, 1, 1.05]} />
        <Part geometry={box(0.018, 0.01, 0.018)} material={material} position={[0, 0.146, -0.012]} />
      </>
    )
  }

  function bag() {
    if (!look.bag) return null
    const material = paint(look.bag, { double: true })
    const side = -1
    return (
      <group position={[side * 0.25, 0, 0.02]}>
        <Part geometry={lofted('tote', [[0.74, 0.034, 0.17], [1.04, 0.03, 0.15]], { segments: 4, offset: Math.PI / 4 })} material={material} shadow />
        {[-0.05, 0.05].map((z) => (
          <Part key={z} geometry={box(0.018, 0.44, 0.006)} material={material} position={[0.065, 1.24, z]} rotation={[0, 0, side * 0.3]} />
        ))}
      </group>
    )
  }

  const legs = ([-1, 1] as const).map((side, i) => leg(side, i))
  const arms = ([-1, 1] as const).map((side, i) => arm(side, i))

  return (
    <group ref={root} position={[start[0], 0, start[1]]} scale={look.height}>
      {legs}
      {skirted
        ? <Part geometry={lofted(look.bottom.kind, look.bottom.kind === 'skirt' ? SKIRT : DRESS, look.bottom.kind === 'skirt' ? { segments: 22, pleat: 0.08 } : { segments: 12 })}
            material={paint(bottomColor)} shadow />
        : <Part geometry={lofted(`pelvis ${look.build}`, build.pelvis, TORSO_OPTIONS)} material={paint(bottomColor)} shadow />}
      <group ref={chest}>
        <Part geometry={lofted(`${torsoKey} lower`, lowerTorso, { ...TORSO_OPTIONS, capBottom: false })} material={paint(topColor)} shadow />
        <Part geometry={lofted(`${torsoKey} upper`, upperTorso, { ...TORSO_OPTIONS, capBottom: false })} material={look.top.kind === 'camisole' ? skinMaterial : paint(topColor)} shadow />
        {outerLayer()}
        {bag()}
        {arms}
        <Part geometry={lofted('neck', [[1.44, 0.046, 0.05], [1.55, 0.043, 0.046, 0.005]])} material={skinMaterial} />
        <group ref={head} position={[0, HEAD_Y, 0]} scale={HEAD_SCALE}>
          <Part geometry={lofted(`head ${look.build}`, build.head, { segments: 10 })} material={skinMaterial} shadow />
          {face()}
          {hair()}
          {glasses()}
          {cap()}
        </group>
      </group>
      {marker && (
        <mesh position={[0, 2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.075, 0.15, 4]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
