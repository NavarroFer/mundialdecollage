import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  attachAvatarAccessories,
  avatarGarmentSlot,
  parseAvatarOutfit,
  prepareAvatar,
} from './avatarOutfit'

describe('avatar outfit', () => {
  it('accepts only known fabrics, slots, colors and accessories from jsonb', () => {
    expect(parseAvatarOutfit({
      garments: {
        top: { color: '#ABCDEF', fabric: 'poplin' },
        face: { color: '#ff0000', fabric: 'leather' },
        shoes: { color: 'red', fabric: 'canvas' },
      },
      accessories: ['beret', 'beret', 'unknown', 4],
    })).toEqual({
      garments: { top: { color: '#abcdef', fabric: 'poplin' } },
      accessories: ['beret'],
    })
  })

  it('matches garment materials without treating skin and hair as clothing', () => {
    expect(avatarGarmentSlot('Adult', 'winter_coat')).toBe('outer')
    expect(avatarGarmentSlot('Adult', 'T_Shirt')).toBe('top')
    expect(avatarGarmentSlot('Adult', 'blue jeans')).toBe('bottom')
    expect(avatarGarmentSlot('Adult', 'leather-shoes')).toBe('shoes')
    expect(avatarGarmentSlot('Body', 'skin')).toBeUndefined()
    expect(avatarGarmentSlot('Head', 'hair')).toBeUndefined()
  })

  it('supports exact material overrides for Rocketbox assets with opaque names', () => {
    expect(avatarGarmentSlot('Adult', 'Material__75', { top: ['Material__75'] })).toBe('top')
  })

  it('clones and customizes only the avatar copy', () => {
    const scene = new THREE.Group()
    const original = new THREE.MeshStandardMaterial({ name: 'T_Shirt', color: '#ffffff' })
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original))
    const { body, materials } = prepareAvatar(scene, {
      garments: { top: { color: '#305080', fabric: 'denim' } },
    })
    const dressed = (body.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(dressed).not.toBe(original)
    expect(dressed.map).toBeInstanceOf(THREE.Texture)
    expect(dressed.normalMap).toBeInstanceOf(THREE.Texture)
    expect(original.map).toBeNull()
    expect(materials).toContain(dressed)
  })

  it('attaches supported accessories only when their target bones exist', () => {
    const root = new THREE.Group()
    for (const name of ['Bip01 Head', 'Bip01 Spine2', 'Bip01 R Hand']) {
      const bone = new THREE.Bone()
      bone.name = name
      root.add(bone)
    }
    const attached = attachAvatarAccessories(root, ['beret', 'apron', 'coffee'])
    expect(attached.map(({ name }) => name).sort()).toEqual([
      'club-accessory:apron',
      'club-accessory:beret',
      'club-accessory:coffee',
    ])
    expect(root.getObjectByName('club-accessory:beret')?.parent?.name).toBe('Bip01 Head')
  })
})
