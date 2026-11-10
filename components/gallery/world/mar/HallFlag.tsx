'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { imageSrc } from '@/lib/image-src'
import { clothBase } from './interiorDecals'
import { FLAG, loadOrder, mosaicCell, mosaicGrid, mosaicUrls } from './mosaic'
import { canvasTexture } from './textures'

/** Where the flag hangs: x centre, z, in the hall's open void near the glass. */
export const FLAG_AT = { x: -5.8, z: -5.2 } as const

const CANVAS_WIDTH = 1024
const CANVAS_HEIGHT = Math.round((CANVAS_WIDTH * FLAG.height) / FLAG.width)
/** Thumbnail width asked of /api/img. The smallest step it serves, already cached by the home and the map. */
const THUMB = 96
/** Browsers multiplex these over one connection (HTTP/2), so more at once is cheap. */
const PARALLEL = 16
/** How often the canvas is re-sent to the GPU while pictures arrive. It is a few MB with its mipmaps, so not per picture. */
const UPLOAD_EVERY_MS = 350

/** Every published obra's image, from the CDN-cached listing the homepage search uses. */
async function fetchObraUrls(signal: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/obras', { signal })
  if (!response.ok) return []
  const entries = (await response.json()) as Array<{ imageUrl?: string | null }>
  return mosaicUrls(entries)
}

function loadThumb(url: string, signal: AbortSignal): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    const done = (result: HTMLImageElement | null) => {
      image.onload = image.onerror = null
      resolve(result)
    }
    image.onload = () => done(image)
    image.onerror = () => done(null)
    signal.addEventListener('abort', () => done(null), { once: true })
    image.src = imageSrc(url, THUMB)
  })
}

/** Draw `image` into a square cell, cropped to fill it, with a hairline of white cloth round it. */
function drawCell(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, cell: number) {
  const pad = Math.max(1, cell * 0.04)
  const size = cell - pad * 2
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  const sx = (image.naturalWidth - side) / 2
  const sy = (image.naturalHeight - side) / 2
  context.drawImage(image, sx, sy, side, side, x + pad, y + pad, size, size)
}

/**
 * The cloth's texture: white until the obras arrive, then the mosaic. It
 * starts from the day's own obras when there are any and widens to every
 * published one, drawing as thumbnails load (a few at a time, uploaded to the
 * GPU in batches, so a long list never stalls a frame).
 */
function useMosaicTexture(seed: string[]) {
  const invalidate = useThree((state) => state.invalidate)
  const base = useMemo(() => clothBase(CANVAS_WIDTH, CANVAS_HEIGHT), [])
  const texture = useMemo(() => {
    const map = canvasTexture(base.canvas, false, 8)
    map.minFilter = THREE.LinearMipmapLinearFilter
    return map
  }, [base])
  const seedKey = seed.join('\n')
  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    const upload = () => {
      timer = null
      texture.needsUpdate = true
      invalidate()
    }
    // At most one upload per interval, however many pictures landed in it.
    const schedule = () => {
      if (timer === null) timer = setTimeout(upload, UPLOAD_EVERY_MS)
    }
    const run = async () => {
      let urls = mosaicUrls(seedKey ? seedKey.split('\n').map((imageUrl) => ({ imageUrl })) : [])
      try {
        const all = await fetchObraUrls(abort.signal)
        if (all.length) urls = all
      } catch {
        // Offline or aborted: the day's obras are what the flag shows.
      }
      if (abort.signal.aborted || !urls.length) return
      const grid = mosaicGrid(urls.length)
      // Cells beyond the last obra stay white. Loaded in a shuffled order so the whole cloth fills at once.
      const order = loadOrder(urls.length)
      let next = 0
      const worker = async () => {
        while (!abort.signal.aborted) {
          const turn = next++
          if (turn >= order.length) return
          const index = order[turn]
          const image = await loadThumb(urls[index], abort.signal)
          if (!image) continue
          const { x, y } = mosaicCell(index, grid)
          drawCell(base.context, image, x, y, grid.cell)
          schedule()
        }
      }
      await Promise.all(Array.from({ length: PARALLEL }, worker))
      if (!abort.signal.aborted) {
        if (timer !== null) clearTimeout(timer)
        upload()
      }
    }
    void run()
    return () => {
      abort.abort()
      if (timer !== null) clearTimeout(timer)
    }
  }, [base, texture, seedKey, invalidate])
  return texture
}

/** Cloth with a gentle fold: a few slow sine ripples across and down, deeper toward the foot. */
function clothGeometry(mirror: boolean) {
  const geometry = new THREE.PlaneGeometry(FLAG.width, FLAG.height, 16, 48)
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    const sway = Math.sin(u * Math.PI * 2.4 + v * 3.1) * 0.1 * (1 - v * 0.55)
    const fold = Math.sin(v * Math.PI * 5.2) * 0.035
    position.setZ(i, sway + fold)
    if (mirror) uv.setX(i, 1 - u)
  }
  geometry.computeVertexNormals()
  return geometry
}

/**
 * The giant flag in the hall: a long cloth hung from the roof beams down to a
 * hand's width above the floor, printed with every obra on the site.
 */
export function HallFlag({ seed = [] }: { seed?: string[] }) {
  const texture = useMosaicTexture(seed)
  const geometries = useMemo(() => ({ front: clothGeometry(false), back: clothGeometry(true) }), [])
  useEffect(() => () => {
    geometries.front.dispose()
    geometries.back.dispose()
  }, [geometries])
  const [top, centre] = [FLAG.bottom + FLAG.height, FLAG.bottom + FLAG.height / 2]
  return (
    <group position={[FLAG_AT.x, 0, FLAG_AT.z]}>
      <mesh geometry={geometries.front} position={[0, centre, 0]} castShadow>
        <meshStandardMaterial map={texture} roughness={0.85} side={THREE.FrontSide} />
      </mesh>
      {/* Same folds, seen from behind, with the picture turned back the right way round. */}
      <mesh geometry={geometries.back} position={[0, centre, 0]}>
        <meshStandardMaterial map={texture} roughness={0.85} side={THREE.BackSide} />
      </mesh>
      {/* Top pole it hangs from, and the weighted pipe in its foot hem. */}
      <mesh position={[0, top + 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, FLAG.width + 0.3, 10]} />
        <meshStandardMaterial color="#3b3d40" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, FLAG.bottom, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, FLAG.width, 10]} />
        <meshStandardMaterial color="#d9dadb" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Two rods up to the beams. */}
      {[-FLAG.width / 2 - 0.1, FLAG.width / 2 + 0.1].map((dx) => (
        <mesh key={dx} position={[dx, top + 0.5, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
          <meshStandardMaterial color="#2f3133" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}
