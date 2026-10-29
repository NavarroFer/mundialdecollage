import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { AVATAR_ACCESSORIES, AVATAR_OUTFIT_FABRICS, type AvatarAccessory } from '@/lib/gallery-catalog'
import { cloth, type Fabric } from './fabrics'

export const AVATAR_GARMENT_SLOTS = ['top', 'outer', 'bottom', 'shoes'] as const
export type AvatarGarmentSlot = (typeof AVATAR_GARMENT_SLOTS)[number]

export type AvatarGarmentStyle = {
  color: string
  fabric: Fabric
}

/** The small JSON document persisted in club_galleries.host_outfit. */
export type AvatarOutfit = {
  garments?: Partial<Record<AvatarGarmentSlot, AvatarGarmentStyle>>
  accessories?: AvatarAccessory[]
}

/**
 * Material-name overrides live with the avatar asset contract, not in user
 * data. They let a future avatar build declare unusual Rocketbox names while
 * the default matcher handles common English garment names.
 */
export type AvatarMaterialSlots = Partial<Record<AvatarGarmentSlot, readonly string[]>>

const fabrics = new Set<string>(AVATAR_OUTFIT_FABRICS)
const accessories = new Set<string>(AVATAR_ACCESSORIES)
const slots = new Set<string>(AVATAR_GARMENT_SLOTS)
const HEX_COLOR = /^#[\da-f]{6}$/i

/** Rejects unknown keys and unsafe values from the gallery's jsonb column. */
export function parseAvatarOutfit(value: unknown): AvatarOutfit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const garments: AvatarOutfit['garments'] = {}
  if (input.garments && typeof input.garments === 'object' && !Array.isArray(input.garments)) {
    for (const [slot, candidate] of Object.entries(input.garments as Record<string, unknown>)) {
      if (!slots.has(slot) || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
      const garment = candidate as Record<string, unknown>
      if (typeof garment.color !== 'string' || !HEX_COLOR.test(garment.color)) continue
      if (typeof garment.fabric !== 'string' || !fabrics.has(garment.fabric)) continue
      garments[slot as AvatarGarmentSlot] = { color: garment.color.toLowerCase(), fabric: garment.fabric as Fabric }
    }
  }
  const selectedAccessories = Array.isArray(input.accessories)
    ? [...new Set(input.accessories.filter((item): item is AvatarAccessory => typeof item === 'string' && accessories.has(item)))]
    : []
  return {
    ...(Object.keys(garments).length > 0 && { garments }),
    ...(selectedAccessories.length > 0 && { accessories: selectedAccessories }),
  }
}

const DEFAULT_SLOT_PATTERNS: Record<AvatarGarmentSlot, RegExp> = {
  outer: /(?:^|[_\s-])(coat|jacket|blazer|cardigan|trench|outer)(?:$|[_\s-])/i,
  top: /(?:^|[_\s-])(shirt|t[ _-]?shirt|tee|blouse|sweater|pullover|top)(?:$|[_\s-])/i,
  bottom: /(?:^|[_\s-])(pants|trousers|jeans|skirt|dress|shorts|bottom)(?:$|[_\s-])/i,
  shoes: /(?:^|[_\s-])(shoe|shoes|boot|boots|sneaker|sneakers|sandal|sandals|loafer|loafers)(?:$|[_\s-])/i,
}

export function avatarGarmentSlot(objectName: string, materialName: string, overrides: AvatarMaterialSlots = {}) {
  const normalizedMaterial = materialName.toLowerCase()
  for (const slot of AVATAR_GARMENT_SLOTS) {
    if (overrides[slot]?.some((name) => name.toLowerCase() === normalizedMaterial)) return slot
  }
  const label = `${objectName} ${materialName}`
  // An outer layer often contains "shirt" in its object name, so test it first.
  for (const slot of ['outer', 'top', 'bottom', 'shoes'] as const) {
    if (DEFAULT_SLOT_PATTERNS[slot].test(label)) return slot
  }
}

function customizedMaterial(
  source: THREE.Material,
  objectName: string,
  outfit: AvatarOutfit,
  materialSlots: AvatarMaterialSlots,
) {
  const material = source.clone()
  if (material.transparent) {
    material.transparent = false
    material.alphaTest = 0.5
    material.alphaToCoverage = true
  }
  const slot = avatarGarmentSlot(objectName, material.name, materialSlots)
  const style = slot ? outfit.garments?.[slot] : undefined
  if (style && material instanceof THREE.MeshStandardMaterial) {
    const parameters = cloth(style.fabric, style.color)
    material.color.copy(parameters.color as THREE.Color)
    material.map = parameters.map ?? null
    material.normalMap = parameters.normalMap ?? null
    material.normalScale.copy(parameters.normalScale ?? new THREE.Vector2(1, 1))
    material.roughness = parameters.roughness ?? material.roughness
    material.needsUpdate = true
  }
  return material
}

const accessoryTemplates = new Map<AvatarAccessory, THREE.Group>()
const accessoryMaterial = (color: string, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position?: [number, number, number]) => {
  const object = new THREE.Mesh(geometry, material)
  if (position) object.position.set(...position)
  object.castShadow = true
  object.frustumCulled = false
  return object
}

/** Accessories use Rocketbox's native centimetre scale (the avatar root is scaled by 0.01). */
function createAccessory(accessory: AvatarAccessory) {
  const group = new THREE.Group()
  group.name = `club-accessory:${accessory}`
  group.userData.clubAvatarAccessory = accessory
  if (accessory === 'beret') {
    group.add(mesh(new THREE.CylinderGeometry(10, 12, 3, 16), accessoryMaterial('#25201d'), [0, 18, 0]))
    group.rotation.z = -0.16
  } else if (accessory === 'glasses') {
    const frame = accessoryMaterial('#2a2420', 0.45, 0.15)
    const lens = (x: number) => mesh(new THREE.TorusGeometry(3.5, 0.45, 5, 12), frame, [x, 10, 7.5])
    group.add(lens(-4.2), lens(4.2), mesh(new THREE.BoxGeometry(2, 0.7, 0.7), frame, [0, 10, 7.5]))
  } else if (accessory === 'apron') {
    group.add(mesh(new THREE.BoxGeometry(34, 45, 1.2), accessoryMaterial('#9b7042'), [0, -20, 11]))
    group.add(mesh(new THREE.BoxGeometry(22, 0.8, 0.8), accessoryMaterial('#dfc298'), [0, 1, 9]))
  } else if (accessory === 'tote') {
    const canvas = accessoryMaterial('#e6dfd0')
    group.add(mesh(new THREE.BoxGeometry(25, 30, 5), canvas, [22, -25, 7]))
    const strap = mesh(new THREE.TorusGeometry(14, 1.2, 6, 16, Math.PI), canvas, [22, -5, 7])
    strap.rotation.z = Math.PI
    group.add(strap)
  } else if (accessory === 'coffee') {
    const cup = accessoryMaterial('#eee8dc')
    group.add(mesh(new THREE.CylinderGeometry(3.8, 3.2, 8, 12), cup, [0, -7, 2]))
    group.add(mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.5, 12), accessoryMaterial('#4c2d1c'), [0, -2.8, 2]))
  } else {
    const steel = accessoryMaterial('#c8c6c0', 0.3, 0.75)
    const blade = (rotation: number) => {
      const part = mesh(new THREE.BoxGeometry(1.2, 11, 0.5), steel, [0, -8, 1])
      part.rotation.z = rotation
      return part
    }
    group.add(blade(-0.22), blade(0.22))
    const handle = accessoryMaterial('#c84135')
    group.add(mesh(new THREE.TorusGeometry(2.2, 0.7, 5, 10), handle, [-2, -14, 1]))
    group.add(mesh(new THREE.TorusGeometry(2.2, 0.7, 5, 10), handle, [2, -14, 1]))
  }
  return group
}

const ACCESSORY_BONES: Record<AvatarAccessory, string> = {
  apron: 'Bip01 Spine2',
  beret: 'Bip01 Head',
  glasses: 'Bip01 Head',
  tote: 'Bip01 Spine2',
  coffee: 'Bip01 R Hand',
  scissors: 'Bip01 R Hand',
}

function accessoryTemplate(accessory: AvatarAccessory) {
  let template = accessoryTemplates.get(accessory)
  if (!template) accessoryTemplates.set(accessory, template = createAccessory(accessory))
  return template
}

export function attachAvatarAccessories(root: THREE.Object3D, selected: readonly AvatarAccessory[] = []) {
  const bones = new Map<string, THREE.Object3D>()
  root.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones.set(object.name, object)
  })
  const attached: THREE.Group[] = []
  for (const accessory of selected) {
    const bone = bones.get(ACCESSORY_BONES[accessory])
    if (!bone) continue
    const object = accessoryTemplate(accessory).clone(true)
    bone.add(object)
    attached.push(object)
  }
  return attached
}

export type PreparedAvatar = {
  body: THREE.Object3D
  materials: THREE.Material[]
  attachedAccessories: THREE.Group[]
}

/** Clones the skeleton, owns every material it mutates, and dresses that clone only. */
export function prepareAvatar(
  scene: THREE.Object3D,
  outfitValue: unknown = {},
  materialSlots: AvatarMaterialSlots = {},
): PreparedAvatar {
  const outfit = parseAvatarOutfit(outfitValue)
  const body = clone(scene)
  const materials: THREE.Material[] = []
  let skeleton: THREE.Skeleton | undefined
  body.traverse((object) => {
    const avatarMesh = object as THREE.SkinnedMesh
    if (!avatarMesh.isMesh) return
    if (avatarMesh.isSkinnedMesh) {
      if (!skeleton) skeleton = avatarMesh.skeleton
      else avatarMesh.bind(skeleton, avatarMesh.bindMatrix)
    }
    avatarMesh.castShadow = true
    avatarMesh.frustumCulled = false
    const sourceMaterials = Array.isArray(avatarMesh.material) ? avatarMesh.material : [avatarMesh.material]
    const owned = sourceMaterials.map((material) => customizedMaterial(material, avatarMesh.name, outfit, materialSlots))
    materials.push(...owned)
    avatarMesh.material = Array.isArray(avatarMesh.material) ? owned : owned[0]
  })
  return { body, materials, attachedAccessories: attachAvatarAccessories(body, outfit.accessories) }
}

