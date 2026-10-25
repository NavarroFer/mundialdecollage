import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { DataTexture, RepeatWrapping, LinearFilter } from 'three'
import { PRESETS } from './quality'
import { useGraphics } from './store'

/** Tiny neutral height field: no downloads, no image colors encoded into normals. */
function microTexture(wood: boolean) {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  let seed = 17
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (seed * 16807) % 2147483647
    const value = wood ? 190 + Math.sin(y * 1.8 + Math.sin(x * 0.09)) * 18 + (seed % 9) : 200 + seed % 24
    const i = (y * size + x) * 4
    data[i] = data[i + 1] = data[i + 2] = value
    data[i + 3] = 255
  }
  const texture = new DataTexture(data, size, size)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(wood ? 18 : 8, wood ? 10 : 8)
  texture.needsUpdate = true
  return texture
}
export function useSurfaceDetail() {
  const quality = useGraphics((s) => s.current)
  const gl = useThree((s) => s.gl)
  const detail = PRESETS[quality].detail
  const maps = useMemo(() => detail ? { wood: microTexture(true), plaster: microTexture(false) } : null, [detail])
  useEffect(() => () => { maps?.wood.dispose(); maps?.plaster.dispose() }, [maps])
  return { maps, anisotropy: Math.min(PRESETS[quality].anisotropy, gl.capabilities.getMaxAnisotropy()) }
}
