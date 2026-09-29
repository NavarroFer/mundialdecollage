import * as THREE from 'three'
import { centroid, cutIntoPieces, seededRandom, type Polygon } from '@/lib/ar/pieces'

// Anchor space (after MindAR's post-matrix): the printed target spans x in
// [-0.5, 0.5] and y in [-aspect/2, aspect/2], centered on the origin, with +z
// coming off the paper toward the camera.
//
// Two ways to show the obra:
// - on the print (default): the target *is* the obra, and the pieces come out
//   of the paper.
// - floating: the target is the Mundial logo card; the obra rises over it
//   the same width as the logo, then breaks apart just the same.

const PIECE_COUNT = 16
const PAPER_EDGE = 0.006

// Seconds for a piece to fly off the paper or settle back into its hole.
const BREAK_DURATION = 1.2
const MEND_DURATION = 1

// Floating mode: seconds for the obra to rise off the card, and how high.
const APPEAR_DURATION = 1.2
const FLOAT_HEIGHT = 0.25

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

type Piece = {
  group: THREE.Group
  shadow: THREE.Mesh
  shadowMaterial: THREE.MeshBasicMaterial
  home: { x: number; y: number }
  drift: { x: number; y: number }
  lift: number
  tilt: { x: number; y: number; z: number }
  phase: number
  delay: number
  // 0 = in its place on the print, 1 = fully lifted. Tweens from `from` to
  // `to` starting at `startedAt`, so a tap mid-way reverses from where it is.
  progress: number
  from: number
  to: number
  startedAt: number
}

function pieceGeometry(poly: Polygon, center: { x: number; y: number }, aspect: number, grow = 0) {
  const shape = new THREE.Shape(
    poly.map((p) => {
      const dx = p.x - center.x
      const dy = p.y - center.y
      const len = Math.hypot(dx, dy) || 1
      return new THREE.Vector2(dx + (dx / len) * grow, dy + (dy / len) * grow)
    }),
  )
  const geometry = new THREE.ShapeGeometry(shape)
  // Map each piece to its own patch of the obra, not the whole image.
  const pos = geometry.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) + center.x + 0.5
    uv[i * 2 + 1] = (pos.getY(i) + center.y) / aspect + 0.5
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

export class CollageScene {
  readonly anchor = new THREE.Group()
  private readonly pieces: Piece[] = []
  // The obra's own space (width 1): the anchor itself on the print, lifted
  // over the card when floating.
  private readonly content = new THREE.Group()
  private readonly floating: boolean
  // Covers the print once the pieces leave it (on the print), or is the
  // obra's shadow on the card (floating).
  private readonly underMaterial: THREE.MeshBasicMaterial
  private appearStartedAt: number | null = null
  private appearPending = true
  private readonly disposables: { dispose(): void }[] = []

  constructor(texture: THREE.Texture, aspect: number, seed: string, { floating = false } = {}) {
    this.anchor.matrixAutoUpdate = false
    this.anchor.visible = false
    this.anchor.add(this.content)
    this.floating = floating
    this.disposables.push(texture)

    this.underMaterial = new THREE.MeshBasicMaterial({
      color: floating ? 0x000000 : 0xefe9dc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const underGeometry = new THREE.PlaneGeometry(1, aspect)
    const under = new THREE.Mesh(underGeometry, this.underMaterial)
    under.renderOrder = 0
    this.anchor.add(under)
    this.disposables.push(underGeometry, this.underMaterial)

    const artMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xfbf8f1, side: THREE.DoubleSide })
    this.disposables.push(artMaterial, edgeMaterial)

    const random = seededRandom(seed)
    for (const poly of cutIntoPieces(1, aspect, PIECE_COUNT, random)) {
      const home = centroid(poly)
      const art = pieceGeometry(poly, home, aspect)
      const edge = pieceGeometry(poly, home, aspect, PAPER_EDGE)
      this.disposables.push(art, edge)

      const group = new THREE.Group()
      group.add(new THREE.Mesh(art, artMaterial))
      const edgeMesh = new THREE.Mesh(edge, edgeMaterial)
      edgeMesh.position.z = -0.0015
      group.add(edgeMesh)
      this.content.add(group)

      const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })
      const shadow = new THREE.Mesh(art, shadowMaterial)
      shadow.renderOrder = 1
      this.content.add(shadow)
      this.disposables.push(shadowMaterial)

      // Pieces drift away from the middle, so the obra opens up like a burst.
      const outward = Math.hypot(home.x, home.y) || 1
      const spread = 0.04 + random() * 0.08
      this.pieces.push({
        group,
        shadow,
        shadowMaterial,
        home,
        drift: { x: (home.x / outward) * spread, y: (home.y / outward) * spread },
        lift: 0.03 + random() * 0.12,
        tilt: { x: (random() - 0.5) * 0.4, y: (random() - 0.5) * 0.4, z: (random() - 0.5) * 0.35 },
        phase: random() * Math.PI * 2,
        delay: random() * 0.35,
        progress: 0,
        from: 0,
        to: 0,
        startedAt: 0,
      })
    }
    this.update(0)
  }

  get broken() {
    return this.pieces[0]?.to === 1
  }

  // Breaks the obra apart, or puts it back together if it's already broken.
  toggle(time: number) {
    const to = this.broken ? 0 : 1
    for (const piece of this.pieces) {
      piece.from = piece.progress
      piece.to = to
      piece.startedAt = time
    }
  }

  // Back to whole with no animation, for when the print is found again.
  reset() {
    for (const piece of this.pieces) piece.progress = piece.from = piece.to = 0
    this.appearPending = true
  }

  // `time`: a running clock in seconds.
  update(time: number) {
    if (this.appearPending) {
      this.appearStartedAt = time
      this.appearPending = false
    }
    if (this.floating) {
      const t = Math.min(1, (time - (this.appearStartedAt ?? time)) / APPEAR_DURATION)
      const a = easeOutCubic(t)
      this.content.position.z = 0.01 + FLOAT_HEIGHT * a + Math.sin(time * 1.2) * 0.012 * a
      this.content.scale.setScalar(0.3 + 0.7 * a)
      this.underMaterial.opacity = 0.22 * a
    }

    let open = 0
    for (const piece of this.pieces) {
      if (piece.progress !== piece.to) {
        const breaking = piece.to > piece.from
        const t = Math.min(1, Math.max(0, (time - piece.startedAt - (breaking ? piece.delay : 0)) / (breaking ? BREAK_DURATION : MEND_DURATION)))
        const eased = breaking ? easeOutCubic(t) : easeInOutCubic(t)
        piece.progress = t === 1 ? piece.to : piece.from + (piece.to - piece.from) * eased
      }
      const p = piece.progress
      open = Math.max(open, p)
      // At rest the real print is the best copy of itself; tracking jitter
      // would only make a flat overlay swim on top of it.
      // Floating, there's no print underneath: the pieces are all there is.
      piece.group.visible = this.floating || p > 0.001
      piece.shadow.visible = !this.floating && p > 0.001
      const float = Math.sin(time * 1.4 + piece.phase) * 0.012 * p
      const x = piece.home.x + piece.drift.x * p
      const y = piece.home.y + piece.drift.y * p
      const z = 0.001 + piece.lift * p + float
      piece.group.position.set(x, y, z)
      piece.group.rotation.set(
        piece.tilt.x * p + Math.sin(time + piece.phase) * 0.05 * p,
        piece.tilt.y * p,
        piece.tilt.z * p,
      )
      piece.shadow.position.set(x + z * 0.15, y - z * 0.2, 0.0008)
      piece.shadow.scale.setScalar(1 + z * 0.3)
      piece.shadowMaterial.opacity = 0.16 * p
    }
    if (!this.floating) this.underMaterial.opacity = Math.min(1, open * 6)
  }

  dispose() {
    for (const d of this.disposables) d.dispose()
  }
}

// MindAR's projection is for the raw camera frame; the video is shown
// "object-fit: cover" style, so the camera's field of view is cropped to
// match whatever part of the frame is visible.
export function fitToContainer(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  video: HTMLVideoElement,
  projection: number[],
  container: HTMLElement,
) {
  const cw = container.clientWidth
  const ch = container.clientHeight
  const videoAspect = video.videoWidth / video.videoHeight
  const containerAspect = cw / ch

  const shownHeight = videoAspect > containerAspect ? ch : cw / videoAspect
  const shownWidth = shownHeight * videoAspect
  Object.assign(video.style, {
    position: 'absolute',
    left: `${(cw - shownWidth) / 2}px`,
    top: `${(ch - shownHeight) / 2}px`,
    width: `${shownWidth}px`,
    height: `${shownHeight}px`,
  })

  const visible = ch / shownHeight
  camera.fov = (2 * Math.atan((1 / projection[5]) * visible) * 180) / Math.PI
  camera.near = projection[14] / (projection[10] - 1)
  camera.far = projection[14] / (projection[10] + 1)
  camera.aspect = containerAspect
  camera.updateProjectionMatrix()
  renderer.setSize(cw, ch)
}
