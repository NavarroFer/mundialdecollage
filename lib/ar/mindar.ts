// MindAR (image tracking) loaded from jsDelivr only on the AR page: the npm
// package drags in TensorFlow and the native `canvas` module, and ~2 MB of
// tracking code has no business in the rest of the site's bundle.

const MINDAR_VERSION = '1.2.5'
const MINDAR_SRC = `https://cdn.jsdelivr.net/npm/mind-ar@${MINDAR_VERSION}/dist/mindar-image.prod.js`

export type MindARController = {
  inputWidth: number
  inputHeight: number
  addImageTargetsFromBuffer(buffer: ArrayBuffer | Uint8Array): { dimensions: [number, number][] }
  dummyRun(input: HTMLVideoElement): void
  processVideo(input: HTMLVideoElement): void
  stopProcessVideo(): void
  dispose(): void
  getProjectionMatrix(): number[]
}

export type MindARUpdate =
  | { type: 'updateMatrix'; targetIndex: number; worldMatrix: number[] | null }
  | { type: 'processDone' }

type MindARImage = {
  Controller: new (options: {
    inputWidth: number
    inputHeight: number
    onUpdate?: (update: MindARUpdate) => void
    maxTrack?: number
    filterMinCF?: number
    filterBeta?: number
  }) => MindARController
  Compiler: new () => {
    compileImageTargets(images: (HTMLImageElement | HTMLCanvasElement)[], onProgress: (percent: number) => void): Promise<unknown>
    exportData(): Uint8Array
  }
}

declare global {
  interface Window {
    MINDAR?: { IMAGE?: MindARImage }
  }
}

let loading: Promise<MindARImage> | null = null

export function loadMindAR(): Promise<MindARImage> {
  if (window.MINDAR?.IMAGE) return Promise.resolve(window.MINDAR.IMAGE)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = MINDAR_SRC
    script.onload = () => (window.MINDAR?.IMAGE ? resolve(window.MINDAR.IMAGE) : reject(new Error('MindAR no se inicializó')))
    script.onerror = () => {
      loading = null
      reject(new Error('No se pudo descargar MindAR'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Compiling reads the pixels back, which a tainted canvas won't allow.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen de la obra'))
    img.src = url
  })
}

// Compile time grows with the pixel count, and tracking doesn't need more
// detail than this.
const MAX_TARGET_SIDE = 1000

export function downscale(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

const CACHE_NAME = 'mundial-ar-targets'
const cacheKey = (imageUrl: string) =>
  `https://ar-targets.local/v${MINDAR_VERSION}-${MAX_TARGET_SIDE}/${encodeURIComponent(imageUrl)}`

// The "huella" MindAR recognizes the printed obra by. Building it takes a few
// seconds on a phone, so it's kept in the Cache API for the next visit.
export async function getImageTarget(
  mindar: MindARImage,
  imageUrl: string,
  img: HTMLImageElement,
  onProgress: (percent: number) => void,
): Promise<ArrayBuffer> {
  try {
    const cached = await (await caches.open(CACHE_NAME)).match(cacheKey(imageUrl))
    if (cached) return await cached.arrayBuffer()
  } catch {
    // No Cache API (private mode, http): compile every time.
  }

  const compiler = new mindar.Compiler()
  await compiler.compileImageTargets([downscale(img, MAX_TARGET_SIDE)], onProgress)
  const data = compiler.exportData()
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer

  try {
    await (await caches.open(CACHE_NAME)).put(cacheKey(imageUrl), new Response(buffer.slice(0)))
  } catch {
    // Same as above.
  }
  return buffer
}
