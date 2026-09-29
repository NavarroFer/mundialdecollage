'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as THREE from 'three'
import { Camera, ScanLine, X } from 'lucide-react'
import { downscale, getImageTarget, loadImage, loadMindAR, type MindARController } from '@/lib/ar/mindar'
import { CollageScene, fitToContainer } from './collage-scene'

// Prototype: the copy is Spanish-only until the feature is confirmed and
// moves into lib/i18n.

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string; progress?: number }
  | { kind: 'scanning' }
  | { kind: 'tracking' }
  | { kind: 'error'; message: string }

type Props = {
  slug: string
  imageUrl: string
  title: string
  name: string
  country: string
  flag: string
}

function cameraErrorMessage(error: unknown) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return 'La cámara solo funciona si la página se abre con https.'
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Necesitamos permiso para usar la cámara. Habilitalo en la configuración del navegador y probá de nuevo.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No encontramos una cámara en este dispositivo.'
  }
  return error instanceof Error ? error.message : 'Algo falló al iniciar la cámara.'
}

export function ArViewer({ slug, imageUrl, title, name, country, flag }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const toggleRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [broken, setBroken] = useState(false)

  useEffect(() => () => stopRef.current?.(), [])

  async function start() {
    const container = containerRef.current!
    const video = videoRef.current!
    const canvas = canvasRef.current!
    let stopped = false
    let stream: MediaStream | null = null
    let controller: MindARController | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let collage: CollageScene | null = null
    let frame = 0
    let onResize: (() => void) | null = null

    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
      if (onResize) window.removeEventListener('resize', onResize)
      toggleRef.current = null
      controller?.dispose()
      stream?.getTracks().forEach((t) => t.stop())
      collage?.dispose()
      renderer?.dispose()
    }
    stopRef.current = stop

    try {
      setStatus({ kind: 'loading', label: 'Abriendo la cámara…' })
      const assets = Promise.all([loadMindAR(), loadImage(imageUrl)])
      // Ask for the camera first, while the tap still counts as a gesture.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } })
      } catch (error) {
        throw new Error(cameraErrorMessage(error))
      }
      video.srcObject = stream
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) resolve()
        else video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      })
      await video.play()
      // MindAR reads the frame size from these attributes, not videoWidth.
      video.width = video.videoWidth
      video.height = video.videoHeight

      setStatus({ kind: 'loading', label: 'Preparando la obra…', progress: 0 })
      const [mindar, img] = await assets
      const target = await getImageTarget(mindar, imageUrl, img, (progress) => {
        if (!stopped) setStatus({ kind: 'loading', label: 'Preparando la obra…', progress })
      })
      if (stopped) return

      const anchorMatrix = new THREE.Matrix4()
      let postMatrix = new THREE.Matrix4()
      let tracking = false
      let lostAt = 0
      const clock = performance.now()
      const seconds = () => (performance.now() - clock) / 1000

      controller = new mindar.Controller({
        inputWidth: video.videoWidth,
        inputHeight: video.videoHeight,
        maxTrack: 1,
        onUpdate: (update) => {
          if (update.type !== 'updateMatrix' || !collage) return
          if (update.worldMatrix === null) {
            collage.anchor.visible = false
            if (tracking) {
              tracking = false
              lostAt = performance.now()
              setStatus({ kind: 'scanning' })
            }
            return
          }
          anchorMatrix.fromArray(update.worldMatrix).multiply(postMatrix)
          collage.anchor.matrix.copy(anchorMatrix)
          collage.anchor.visible = true
          if (!tracking) {
            tracking = true
            // A tracking hiccup keeps the pieces where they were; pointing at
            // the print again after a while starts over from the whole obra.
            if (performance.now() - lostAt > 2000) {
              collage.reset()
              setBroken(false)
            }
            setStatus({ kind: 'tracking' })
          }
        },
      })
      const [[w, h]] = controller.addImageTargetsFromBuffer(target).dimensions
      // Anchor space: 1 unit = the print's width, origin at its center.
      postMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(w / 2, h / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(w, w, w),
      )

      const texture = new THREE.CanvasTexture(downscale(img, 2048))
      texture.colorSpace = THREE.SRGBColorSpace
      collage = new CollageScene(texture, h / w, slug)

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      const scene = new THREE.Scene()
      scene.add(collage.anchor)
      const camera = new THREE.PerspectiveCamera()
      const projection = controller.getProjectionMatrix()
      onResize = () => fitToContainer(camera, renderer!, video, projection, container)
      onResize()
      window.addEventListener('resize', onResize)

      // Builds the GPU kernels up front, otherwise the first frames stall.
      await controller.dummyRun(video)
      if (stopped) return
      controller.processVideo(video)
      setStatus({ kind: 'scanning' })

      toggleRef.current = () => {
        if (!tracking || !collage) return
        collage.toggle(seconds())
        setBroken(collage.broken)
        navigator.vibrate?.(15)
      }

      const render = () => {
        collage!.update(seconds())
        renderer!.render(scene, camera)
        frame = requestAnimationFrame(render)
      }
      render()
    } catch (error) {
      stop()
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Algo falló.' })
    }
  }

  const running = status.kind !== 'idle' && status.kind !== 'error'

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-ink text-white"
      onClick={(event) => {
        if (!(event.target as Element).closest('a, button')) toggleRef.current?.()
      }}
    >
      {/* max-w-none: Tailwind's reset caps videos at 100% width, which would
          letterbox the feed instead of covering the screen like the 3D layer. */}
      <video ref={videoRef} muted playsInline className={running ? 'max-w-none' : 'hidden'} />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <Link
        href={`/obras/${slug}`}
        aria-label="Cerrar"
        className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur"
      >
        <X className="h-5 w-5" />
      </Link>

      {(status.kind === 'idle' || status.kind === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="max-h-[38vh] rounded-lg shadow-2xl" />
          <div className="max-w-sm">
            <h1 className="font-display text-2xl tracking-tight uppercase">{title}</h1>
            <p className="mt-1 text-white/70">
              {flag} {name}
            </p>
            <p className="mt-5 text-sm text-white/80">
              {status.kind === 'error'
                ? status.message
                : 'Apuntá la cámara a esta obra impresa (o abierta en otra pantalla) y mirá qué pasa.'}
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-full bg-collage-red px-6 py-3 font-semibold"
          >
            <Camera className="h-5 w-5" />
            {status.kind === 'error' ? 'Probar de nuevo' : 'Activar cámara'}
          </button>
        </div>
      )}

      {status.kind === 'loading' && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center px-6">
          <div className="rounded-full bg-black/60 px-5 py-3 text-sm backdrop-blur">
            {status.label}
            {status.progress !== undefined && ` ${Math.round(status.progress)}%`}
          </div>
        </div>
      )}

      {status.kind === 'scanning' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
          <ScanLine className="h-24 w-24 animate-pulse text-white/70" strokeWidth={1} />
          <p className="rounded-full bg-black/60 px-5 py-3 text-sm backdrop-blur">Apuntá a la obra impresa</p>
        </div>
      )}

      {status.kind === 'tracking' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-6">
          <div className="rounded-2xl bg-black/60 px-5 py-3 text-center backdrop-blur">
            <p className="font-display tracking-tight uppercase">{title}</p>
            <p className="text-sm text-white/70">
              {flag} {name} · {country}
            </p>
            <p className="mt-2 text-xs font-semibold tracking-wide text-collage-yellow uppercase">
              {broken ? 'Tocá para volver a armarla' : 'Tocá la pantalla para romperla'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
