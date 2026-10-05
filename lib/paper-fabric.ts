// Browser only. The scissors' payoff: the strip of page between the cut and
// the bottom of the screen comes loose and drops like a piece of cloth —
// it folds over itself several times, piles up at the bottom of the screen,
// rests there in view, and is then lifted back into place from the top.
//
// The cloth shows the real page: each fold is a clipped copy of what was on
// screen below the cut, nested hinge inside hinge from the bottom up so the
// folds stay joined at every frame. The real page underneath is covered (not
// moved), and the copies start and end perfectly flat over it, so the swap is
// invisible. Lighting is computed from each fold's actual tilt.

// Timeline, in ms from the click. The scissors' sweep (globals.css) takes the
// first 800ms; the cloth gives way just before it finishes.
const FALL_START = 650
const FOLD_MS = 760
const FALL_STAGGER = 120
const UNFOLD_START = 3700
// Lifting it back is brisker than the fall.
const UNFOLD_MS = 520
const UNFOLD_STAGGER = 55
export const FABRIC_TOTAL_MS = 4800

const FRAME_MS = 1000 / 40
const PERSPECTIVE = 1400
// Where the light comes from: above the screen, tilted this far toward the
// viewer. Folds that face up catch it, folds that face the floor go dark.
const LIGHT_ANGLE = (50 * Math.PI) / 180

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
// Accelerates like a falling thing, overshoots a little as the fold lands,
// and settles — cloth doesn't stop dead.
function landing(x: number) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  if (x < 0.62) return 1.07 * (x / 0.62) ** 2
  const settle = (x - 0.62) / 0.38
  return 1.07 - 0.07 * (1 - (1 - settle) ** 2)
}

// Fold heights vary like real cloth: never a neat accordion.
function foldHeights(total: number): number[] {
  const count = Math.min(10, Math.max(6, Math.round(total / 60)))
  const weights = Array.from({ length: count }, () => 0.6 + Math.random() * 0.8)
  const sum = weights.reduce((a, b) => a + b, 0)
  const heights = weights.map((w) => Math.round((w / sum) * total))
  heights[heights.length - 1] += total - heights.reduce((a, b) => a + b, 0)
  return heights
}

// A copy that looks like the original but can't play, load late, or be
// reached: ids would clash with the real page, lazy images inside a 3D
// transform may never decode in time.
function sanitize(clone: Element, original: Element) {
  for (const el of [clone, ...clone.querySelectorAll('[id]')]) el.removeAttribute('id')
  for (const img of clone.querySelectorAll('img')) {
    img.loading = 'eager'
    img.decoding = 'sync'
  }
  for (const video of clone.querySelectorAll('video')) {
    video.removeAttribute('autoplay')
    video.preload = 'none'
  }
  for (const iframe of clone.querySelectorAll('iframe')) iframe.removeAttribute('src')
  const sourceCanvases = original.querySelectorAll('canvas')
  clone.querySelectorAll('canvas').forEach((canvas, i) => {
    try {
      canvas.getContext('2d')?.drawImage(sourceCanvases[i], 0, 0)
    } catch {
      // WebGL or tainted canvases stay blank; the fold is gone in a second.
    }
  })
}

const between = (min: number, max: number) => min + Math.random() * (max - min)

// Cloth never folds in clean bands: a few soft wrinkles across each fold, a
// shadow on one side of the ridge and a glint on the other, never twice alike.
function wrinkles() {
  const layers: string[] = []
  for (let i = 0; i < 3; i++) {
    const x = between(5, 95)
    const width = between(8, 22)
    const y = between(10, 90)
    layers.push(
      `radial-gradient(${width}% 120% at ${x}% ${y}%, rgb(27 17 12 / ${between(0.18, 0.32)}), transparent 70%)`,
      `radial-gradient(${width * 0.6}% 90% at ${x + width * 0.45}% ${y}%, rgb(255 255 255 / ${between(0.12, 0.24)}), transparent 70%)`,
    )
  }
  layers.push('linear-gradient(180deg, rgb(27 17 12 / 45%), rgb(27 17 12 / 0%) 18%, rgb(27 17 12 / 0%) 80%, rgb(27 17 12 / 40%))')
  return layers.join(', ')
}

function div(className: string, style: Partial<CSSStyleDeclaration> = {}) {
  const el = document.createElement('div')
  el.className = className
  Object.assign(el.style, style)
  return el
}

// Drops everything below `cutY` (viewport px). Returns a function that removes
// the cloth early; otherwise call it after FABRIC_TOTAL_MS.
export function dropPageFabric(cutAt: number): () => void {
  // Whole pixels, so the flat copies land exactly on the page they replace.
  const cutY = Math.round(cutAt)
  const main = document.querySelector('#site-content main')
  const viewportHeight = window.innerHeight
  const height = Math.round(viewportHeight - cutY)
  if (!main || height < 60) return () => {}

  const top = cutY + window.scrollY
  const root = div('paper-fabric', {
    top: `${top}px`,
    height: `${height}px`,
    perspective: `${PERSPECTIVE}px`,
    perspectiveOrigin: `50% ${viewportHeight / 2 - cutY}px`,
  })
  root.setAttribute('aria-hidden', 'true')
  root.inert = true
  // Covers the real page from the cut down — the cloth is all that's left of
  // it. Runs to the end of the document so a scroll mid-cut doesn't peek.
  const floor = div('paper-fabric-floor', {
    height: `${Math.max(height, document.documentElement.scrollHeight - top)}px`,
  })
  const shadow = div('paper-fabric-shadow')
  root.append(floor, shadow)
  document.body.append(root)

  // What's on screen below the cut, read once from the real page: where each
  // piece sits, which of its parts are mid-animation (the flag ribbon never
  // stops) and which are fixed-position.
  const footer = main.nextElementSibling?.tagName === 'FOOTER' ? [main.nextElementSibling] : []
  // Every CSS animation in a piece (pseudo-elements included), keyed by where
  // it runs so an original and its copy line up.
  function animationsOf(piece: Element, all: Element[]) {
    const index = new Map(all.map((el, i) => [el, i]))
    return piece.getAnimations({ subtree: true }).flatMap((anim) => {
      if (!(anim instanceof CSSAnimation) || !(anim.effect instanceof KeyframeEffect) || !anim.effect.target) return []
      return [{ anim, key: `${index.get(anim.effect.target)}${anim.effect.pseudoElement ?? ''} ${anim.animationName}` }]
    })
  }
  const pieces = [...main.children, ...footer].flatMap((original) => {
    const rect = original.getBoundingClientRect()
    if (rect.bottom <= cutY || rect.top >= viewportHeight) return []
    const all = [original, ...original.querySelectorAll('*')]
    const running = new Map(animationsOf(original, all).map(({ anim, key }) => [key, anim.currentTime]))
    const fixed = all.flatMap((el, i) => (getComputedStyle(el).position === 'fixed' ? [i] : []))
    return [{ original, rect, running, fixed }]
  })

  // Copies all of it into `slice`, laid out exactly where the originals are in
  // the cloth's coordinates (0 = the cut). The slice must already be in the
  // document, so the copies' animations exist to be stopped on the very frame
  // the originals were showing — otherwise everything jumps as the cut lands.
  function fillSlice(slice: HTMLElement) {
    for (const { original, rect, running, fixed } of pieces) {
      const clone = original.cloneNode(true) as HTMLElement
      sanitize(clone, original)
      Object.assign(clone.style, {
        position: 'absolute',
        top: `${rect.top - cutY}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        margin: '0',
      })
      slice.append(clone)
      const all = [clone, ...clone.querySelectorAll('*')]
      for (const { anim, key } of animationsOf(clone, all)) {
        anim.currentTime = running.get(key) ?? 0
        anim.pause()
      }
      // Fixed-position bits (floating buttons) would land somewhere else
      // entirely inside a transformed fold, so they don't come along.
      for (const i of fixed) all[i].remove()
    }
  }

  // Hinges nest from the bottom fold up: each one sits on top of its parent
  // and turns around their shared edge, so the cloth never tears apart.
  const heights = foldHeights(height)
  const hinges: HTMLElement[] = []
  const faces: { light: HTMLElement; dark: HTMLElement; crease: HTMLElement }[] = []
  let parent: HTMLElement = root
  let bottom = height
  heights.forEach((foldHeight, k) => {
    const hinge = div('paper-fabric-hinge', { height: `${foldHeight}px`, bottom: k === 0 ? '0' : '100%' })
    const face = div('paper-fabric-face')
    // The face reaches 1px above its fold, under the next one, so no seam of
    // floor shows between flat folds.
    const slice = div('paper-fabric-slice', { height: `${height}px`, top: `${-(bottom - foldHeight - 1)}px` })
    const light = div('paper-fabric-light')
    const dark = div('paper-fabric-dark')
    const crease = div('paper-fabric-crease', { backgroundImage: wrinkles() })
    face.append(slice, crease, light, dark)
    hinge.append(face)
    parent.append(hinge)
    fillSlice(slice)
    parent = hinge
    bottom -= foldHeight
    hinges.push(hinge)
    faces.push({ light, dark, crease })
  })

  // Each fold's own tilt over time. Folds alternate toward and away from the
  // viewer (that's what makes a pile), each by its own amount; the bottom
  // folds land first and the rest of the cloth comes down onto them.
  const count = heights.length
  // Past ~74° a fold facing the floor would turn its back on the viewer.
  const angles = heights.map((_, k) => (k % 2 === 0 ? -1 : 1) * (between(60, 74) * Math.PI) / 180)
  // The pile lands a little skewed and turned, like anything dropped.
  const twist = between(-1.4, 1.4)
  const turn = between(-7, 7)
  const lastLanding = FALL_START + (count - 1) * FALL_STAGGER + FOLD_MS
  // While it is still coming down, the loose part of the cloth ripples.
  function flutter(k: number, t: number) {
    const u = (t - FALL_START) / (lastLanding - FALL_START)
    if (u <= 0 || u >= 1) return 0
    return 0.09 * Math.sin(Math.PI * u) * Math.sin(t / 95 + k * 1.3)
  }
  function progress(k: number, t: number) {
    const unfoldAt = UNFOLD_START + (count - 1 - k) * UNFOLD_STAGGER
    if (t >= unfoldAt) return 1 - easeInOut(clamp01((t - unfoldAt) / UNFOLD_MS))
    return landing((t - FALL_START - k * FALL_STAGGER) / FOLD_MS)
  }

  const frames = Math.ceil(FABRIC_TOTAL_MS / FRAME_MS)
  const hingeFrames: Keyframe[][] = hinges.map(() => [])
  const lightFrames: Keyframe[][] = hinges.map(() => [])
  const darkFrames: Keyframe[][] = hinges.map(() => [])
  const creaseFrames: Keyframe[][] = hinges.map(() => [])
  const shadowFrames: Keyframe[] = []
  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * FABRIC_TOTAL_MS
    const piled = heights.reduce((sum, _, k) => sum + progress(k, t) / count, 0)
    let previous = 0
    for (let k = 0; k < count; k++) {
      const p = progress(k, t)
      const tilt = angles[k] * p + flutter(k, t) * (1 - clamp01(p))
      const settle = k === 0 ? `rotateZ(${twist * piled}deg) rotateY(${turn * piled}deg) ` : ''
      hingeFrames[k].push({ transform: `${settle}rotateX(${tilt - previous}rad)` })
      previous = tilt
      // Brightness of a fold tilted `tilt` under the light, against how it
      // looked flat: above 0 it catches light, below it falls into shadow.
      const lit = Math.cos(tilt - LIGHT_ANGLE) - Math.cos(LIGHT_ANGLE)
      lightFrames[k].push({ opacity: clamp01(lit / (1 - Math.cos(LIGHT_ANGLE))) * 0.55 })
      darkFrames[k].push({ opacity: clamp01(-lit / (Math.cos(LIGHT_ANGLE) + 0.4)) * 0.85 })
      creaseFrames[k].push({ opacity: clamp01(p) })
    }
    shadowFrames.push({ opacity: piled })
  }
  const timing: KeyframeAnimationOptions = { duration: FABRIC_TOTAL_MS, fill: 'both' }
  hinges.forEach((hinge, k) => {
    hinge.animate(hingeFrames[k], timing)
    faces[k].light.animate(lightFrames[k], timing)
    faces[k].dark.animate(darkFrames[k], timing)
    faces[k].crease.animate(creaseFrames[k], timing)
  })
  shadow.animate(shadowFrames, timing)

  return () => root.remove()
}
