// Runs inside headless Chrome (build.mjs): three.js's FBX loader and glTF
// exporter need a browser. Reads each cast member straight from the
// Rocketbox repository, writes plain glTF back to build.mjs, which compresses it.
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { AVATARS_VERSION, CAST, type CastMember } from '../../components/gallery/world/people/cast'

const ROCKETBOX = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets'
const folder = (name: string) => `${ROCKETBOX}/Avatars/${name.startsWith('Business_') ? 'Professions' : 'Adults'}/${name}`

// The exporter draws images onto a canvas; TGA arrives as raw pixel data.
function toCanvas(texture: THREE.Texture | null) {
  const image = texture?.image as { data?: Uint8Array | null; width: number; height: number } | undefined
  if (!texture || !image || image.data === undefined) return
  if (image.data === null) throw new Error(`texture without pixels: ${texture.name}`)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const rgba = new Uint8ClampedArray(image.width * image.height * 4)
  const channels = image.data.length / (image.width * image.height)
  for (let i = 0; i < image.width * image.height; i++) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = image.data[i * channels + c]
    rgba[i * 4 + 3] = channels === 4 ? image.data[i * channels + 3] : 255
  }
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, image.width, image.height), 0, 0)
  texture.image = canvas
}

// Lights and cameras from 3ds Max, and the animation files' preview meshes, don't belong in the output.
function strip(group: THREE.Object3D, meshes = false) {
  const strays: THREE.Object3D[] = []
  group.traverse((o: any) => { if (o.isLight || o.isCamera || (meshes && o.isMesh)) strays.push(o) })
  strays.forEach((o) => o.removeFromParent())
}

/** One draw call per material instead of one per group: each material's triangles made contiguous. */
function groupByMaterial(geometry: THREE.BufferGeometry) {
  const index = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: geometry.attributes.position.count }, (_, i) => i)
  const byMaterial = new Map<number, number[]>()
  for (const { start, count, materialIndex = 0 } of geometry.groups) {
    const list = byMaterial.get(materialIndex) ?? []
    for (let i = start; i < start + count; i++) list.push(index[i])
    byMaterial.set(materialIndex, list)
  }
  const merged: number[] = []
  geometry.clearGroups()
  for (const [materialIndex, list] of [...byMaterial].sort((a, b) => a[0] - b[0])) {
    geometry.addGroup(merged.length, list.length, materialIndex)
    merged.push(...list)
  }
  geometry.setIndex(merged)
}

async function send(file: string, object: THREE.Object3D, animations: THREE.AnimationClip[] = []) {
  const glb = await new GLTFExporter().parseAsync(object, { binary: true, animations }) as ArrayBuffer
  const response = await fetch(`/out/${file}`, { method: 'POST', body: glb })
  if (!response.ok) throw new Error(`couldn't save ${file}`)
}

async function avatar({ name }: CastMember) {
  const manager = new THREE.LoadingManager()
  manager.addHandler(/\.tga$/i, new TGALoader(manager))
  const loader = new FBXLoader(manager)
  loader.setResourcePath(`${folder(name)}/Textures/`)
  // Textures keep loading after the FBX resolves.
  const textures = new Promise<void>((resolve) => { manager.onLoad = () => resolve() })
  const group = await loader.loadAsync(`${folder(name)}/Export/${name}.fbx`)
  await textures
  strip(group)
  group.traverse((o: any) => {
    if (!o.isMesh) return
    if (Array.isArray(o.material)) groupByMaterial(o.geometry)
    // 3ds Max's Phong to glTF's standard material; hair and lashes keep their alpha.
    o.material = (Array.isArray(o.material) ? o.material : [o.material]).map((m: any) => {
      for (const key of ['map', 'normalMap', 'alphaMap']) toCanvas(m[key])
      return new THREE.MeshStandardMaterial({
        name: m.name, map: m.map, normalMap: m.normalMap, roughness: 0.75,
        transparent: Boolean(m.alphaMap || m.transparent), side: m.alphaMap ? THREE.DoubleSide : THREE.FrontSide,
      })
    })
  })
  // Rocketbox works in centimeters.
  group.scale.setScalar(0.01)
  await send(`${name}.glb`, group)
}

/**
 * Walk and idle for one sex, on its own skeleton. Rotations only, so each
 * body keeps its proportions; the hips keep their height but are pinned in
 * place sideways, since the gallery moves people itself.
 */
async function animations(sex: CastMember['sex']) {
  const load = (path: string) => new FBXLoader().loadAsync(`${ROCKETBOX}/Animations/${path}.max.fbx`)
  const walkScene = await load(`all_animations_max_motextr_xy/${sex}_walk_neutral_01`)
  const idleScene = await load(`all_animations_max_motextr_static/${sex}_idle_neutral_01`)
  const tidy = (clip: THREE.AnimationClip, name: string) => {
    const tracks = clip.tracks.filter((track) => {
      const [node, property] = track.name.split('.')
      return property === 'quaternion' || (property === 'position' && node === 'Bip01')
    })
    const hips = tracks.find((track) => track.name === 'Bip01.position')!.values
    const travel = Math.hypot(hips[hips.length - 3] - hips[0], hips[hips.length - 1] - hips[2]) / 100
    for (let i = 0; i < hips.length; i += 3) { hips[i] = hips[0]; hips[i + 2] = hips[2] }
    return { clip: new THREE.AnimationClip(name, clip.duration, tracks), speed: travel / clip.duration }
  }
  const walk = tidy(walkScene.animations[0], 'walk')
  const idle = tidy(idleScene.animations[0], 'idle')
  strip(walkScene, true)
  walkScene.scale.setScalar(0.01)
  await send(`animations-${sex}.glb`, walkScene, [walk.clip, idle.clip])
  return walk.speed
}

async function run() {
  const report: Record<string, unknown> = {
    version: AVATARS_VERSION,
    walkSpeed: {},
    // Rocketbox's own preview of each person, for the avatar picker.
    thumbnails: Object.fromEntries(CAST.map(({ name }) => [name, `${folder(name)}/${name}.png`])),
  }
  for (const sex of ['f', 'm'] as const) (report.walkSpeed as Record<string, number>)[sex] = await animations(sex)
  for (const member of CAST) {
    await avatar(member)
    console.log(`converted ${member.name}`)
  }
  ;(window as unknown as { report: unknown }).report = report
}

run().catch((error) => { (window as unknown as { report: unknown }).report = { error: String(error?.stack ?? error) } })
