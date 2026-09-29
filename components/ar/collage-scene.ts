import * as THREE from 'three'
import { centroid, cutIntoPieces, seededRandom, type Polygon } from '@/lib/ar/pieces'

// Anchor space (after MindAR's post-matrix): the printed obra spans x in
// [-0.5, 0.5] and y in [-aspect/2, aspect/2], centered on the origin, with +z
// coming off the paper toward the camera.

const PIECE_COUNT = 16
const PAPER_EDGE = 0.006

// One loop of the effect, in seconds: the pieces lift off the paper, float,
// settle back into place and rest before starting over.
const LIFT_END = 1.4
const HOLD_END = 5
const SETTLE_END = 6.4
const CYCLE = 7.6
// Pause after the obra is found, so the print is seen whole before it breaks up.
const START_DELAY = 0.6

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

function envelope(t: number): number {
  if (t < 0) return 0
  const x = t % CYCLE
  if (x < LIFT_END) return easeOutCubic(x / LIFT_END)
  if (x < HOLD_END) return 1
  if (x < SETTLE_END) return 1 - easeInOutCubic((x - HOLD_END) / (SETTLE_END - HOLD_END))
  return 0
}

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
  private readonly paperMaterial: THREE.MeshBasicMaterial
  private readonly disposables: { dispose(): void }[] = []

  constructor(texture: THREE.Texture, aspect: number, seed: string) {
    this.anchor.matrixAutoUpdate = false
    this.anchor.visible = false
    this.disposables.push(texture)

    // Covers the print once the pieces leave it, as if they'd been cut out of
    // the paper.
    this.paperMaterial = new THREE.MeshBasicMaterial({ color: 0xefe9dc, transparent: true, opacity: 0, depthWrite: false })
    const paperGeometry = new THREE.PlaneGeometry(1, aspect)
    const paper = new THREE.Mesh(paperGeometry, this.paperMaterial)
    paper.renderOrder = 0
    this.anchor.add(paper)
    this.disposables.push(paperGeometry, this.paperMaterial)

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
      this.anchor.add(group)

      const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })
      const shadow = new THREE.Mesh(art, shadowMaterial)
      shadow.renderOrder = 1
      this.anchor.add(shadow)
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
      })
    }
    this.update(0, 0)
  }

  // `sinceFound`: seconds since the print was recognized; `time`: a running
  // clock for the idle float.
  update(sinceFound: number, time: number) {
    let open = 0
    for (const piece of this.pieces) {
      const p = envelope(sinceFound - START_DELAY - piece.delay)
      open = Math.max(open, p)
      // At rest the real print is the best copy of itself; tracking jitter
      // would only make a flat overlay swim on top of it.
      piece.group.visible = piece.shadow.visible = p > 0.001
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
    this.paperMaterial.opacity = Math.min(1, open * 6)
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
