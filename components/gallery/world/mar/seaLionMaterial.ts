import * as THREE from 'three'
import { canvasOf, canvasTexture, seeded, WEAVE_TILE } from './textures'

/**
 * The photographed covering is individual, concave alfajor wrappers. The
 * generated colour tile has 16 columns × 8 rows; data maps follow those same
 * packet edges, so the dots stay printed while the folded foil catches light.
 */
function goldMaps(source: THREE.Texture) {
  const size = 512
  const height = canvasOf(size, size)
  const roughness = canvasOf(size, size)
  const bump = height.context.createImageData(size, size)
  const sheen = roughness.context.createImageData(size, size)
  const random = seeded(23)
  const tones = Array.from({ length: 128 }, () => random())
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x % 32) / 32
      const v = (y % 64) / 64
      const edge = Math.min(u, 1 - u, v, 1 - v)
      const inset = THREE.MathUtils.smoothstep(edge, 0, 0.035)
      const waist = Math.pow(Math.abs(v * 2 - 1), 1.7)
      const fold = 0.19 + 0.57 * waist * Math.pow(Math.sin(Math.PI * u), 0.4) + 0.15 * Math.pow(Math.abs(u * 2 - 1), 3)
      const crimp = (v < 0.07 || v > 0.94) ? Math.sin(v * 450) * 0.035 : 0
      const h = Math.round(255 * THREE.MathUtils.clamp((fold + crimp) * inset, 0, 1))
      const r = Math.round(150 + 44 * tones[Math.floor(y / 64) * 16 + Math.floor(x / 32)] + 28 * (1 - inset))
      const i = (y * size + x) * 4
      bump.data.set([h, h, h, 255], i)
      sheen.data.set([r, r, r, 255], i)
    }
  }
  height.context.putImageData(bump, 0, 0)
  roughness.context.putImageData(sheen, 0, 0)
  // Clone the useLoader cache entry: this component owns/disposes only its copy.
  const map = source.clone()
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.anisotropy = 8
  map.needsUpdate = true
  const bumpMap = canvasTexture(height.canvas)
  const roughnessMap = canvasTexture(roughness.canvas)
  bumpMap.colorSpace = THREE.NoColorSpace
  roughnessMap.colorSpace = THREE.NoColorSpace
  return { map, bumpMap, roughnessMap }
}

/** A local outdoor reflection map so the gold also works at low graphics quality. */
function plazaReflection() {
  const { canvas, context } = canvasOf(512, 256)
  const sky = context.createLinearGradient(0, 0, 0, 256)
  sky.addColorStop(0, '#a2bfd9')
  sky.addColorStop(0.4, '#dce4e8')
  sky.addColorStop(0.52, '#f0ece0')
  sky.addColorStop(0.6, '#aaa69b')
  sky.addColorStop(1, '#777669')
  context.fillStyle = sky
  context.fillRect(0, 0, 512, 256)
  // Broad concrete masses behind and beside the sculpture, below open sky.
  context.fillStyle = '#b9b7ac'
  context.fillRect(28, 79, 120, 68)
  context.fillStyle = '#bfc0b7'
  context.fillRect(148, 91, 94, 56)
  context.fillStyle = '#4b5559'
  context.fillRect(34, 131, 202, 13)
  const texture = canvasTexture(canvas, false)
  texture.mapping = THREE.EquirectangularReflectionMapping
  return texture
}

export function seaLionGoldMaterial(source: THREE.Texture) {
  const maps = goldMaps(source)
  const envMap = plazaReflection()
  const material = new THREE.MeshPhysicalMaterial({
    ...maps,
    color: '#ffffff',
    metalness: 0.86,
    roughness: 0.58,
    bumpScale: 0.28,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    envMap,
    envMapIntensity: 0.7,
  })
  // World-space triplanar mapping preserves the 10 × 20 cm wrappers across the chest,
  // tight muzzle, and stretched haunch. UVs alone stretch badly on those forms.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vGoldPosition;\nvarying vec3 vGoldNormal;\n${shader.vertexShader}`
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vGoldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGoldNormal = normalize(mat3(modelMatrix) * objectNormal);`)
    shader.fragmentShader = `
      varying vec3 vGoldPosition;
      varying vec3 vGoldNormal;
      vec4 goldSample(sampler2D source, vec3 position) {
        vec3 weight = pow(abs(normalize(vGoldNormal)), vec3(8.0));
        weight /= max(dot(weight, vec3(1.0)), 0.00001);
        vec3 p = position / ${WEAVE_TILE.toFixed(4)};
        return texture2D(source, p.zy) * weight.x
          + texture2D(source, p.xz) * weight.y
          + texture2D(source, p.xy) * weight.z;
      }
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', 'diffuseColor *= goldSample(map, vGoldPosition);')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * goldSample(roughnessMap, vGoldPosition).g;')
      .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment.replace(
        /vec2 dHdxy_fwd\(\) \{[\s\S]*?\n\t\}/,
        `vec2 dHdxy_fwd() {
          float h = goldSample(bumpMap, vGoldPosition).r;
          return bumpScale * vec2(
            goldSample(bumpMap, vGoldPosition + dFdx(vGoldPosition)).r - h,
            goldSample(bumpMap, vGoldPosition + dFdy(vGoldPosition)).r - h
          );
        }`,
      ))
  }
  material.customProgramCacheKey = () => 'mar-wrappers-triplanar-v2'
  return { material, textures: [...Object.values(maps), envMap] }
}
