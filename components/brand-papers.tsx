import type { Ref } from 'react'
import type { PaperExit, PaperTarget } from '@/components/paper-shards'

// Where the splash's three big papers sit: blue top left, red bottom right, a
// yellow strip across. Never shown: PaperShards measures them
// (measurePapers) and draws the papers itself, so its torn scraps can gather
// into them and they can leave the frame in the same movement.

const BLUE_OUTLINE = 'polygon(3% 6%, 94% 0, 100% 22%, 93% 52%, 100% 91%, 68% 100%, 38% 92%, 0 100%)'
const RED_OUTLINE = 'polygon(10% 4%, 62% 0, 96% 15%, 90% 44%, 100% 72%, 80% 100%, 38% 94%, 0 100%, 6% 55%, 0 24%)'

// How each one clears the frame: moved by a share of its own width and
// height, turned (degrees), the strip fading as it goes.
const EXITS: Record<PaperTarget['ink'], Omit<PaperExit, 'x' | 'y'> & { across: number; down: number }> = {
  blue: { across: -1.15, down: -0.18, turn: -8, delay: 0, fade: false },
  red: { across: 1.15, down: 0.18, turn: 8, delay: 0.03, fade: false },
  yellow: { across: 1.15, down: 0, turn: 0, delay: 0.08, fade: true },
}

export function BrandPapers({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none invisible absolute inset-0">
      <div
        data-paper="blue"
        className="absolute -top-[18vh] -left-[18vw] h-[66vh] w-[58vw] -rotate-[5deg] sm:-left-[8vw] sm:w-[42vw]"
        style={{ clipPath: BLUE_OUTLINE }}
      />
      <div
        data-paper="red"
        className="absolute -right-[17vw] -bottom-[20vh] h-[67vh] w-[58vw] rotate-[5deg] sm:-right-[8vw] sm:w-[42vw]"
        style={{ clipPath: RED_OUTLINE }}
      />
      <div data-paper="yellow" className="torn-strip absolute inset-x-[-8%] top-[52%] h-14 -rotate-3 sm:h-20" />
    </div>
  )
}

const length = (value: string, size: number) => (value.endsWith('%') ? (parseFloat(value) / 100) * size : parseFloat(value) || 0)

/**
 * Each paper's outline as it sits on screen, in the pixels of the box that
 * holds BrandPapers (its box, clip-path, rotation and any transform), and
 * the pivot and path it leaves by.
 */
export function measurePapers(root: HTMLElement | null): PaperTarget[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>('[data-paper]')).map((element) => {
    const ink = element.dataset.paper as PaperTarget['ink']
    const style = getComputedStyle(element)
    const width = element.offsetWidth
    const height = element.offsetHeight
    const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat)
    let matrix = new DOMMatrix().translate(element.offsetLeft + ox, element.offsetTop + oy)
    if (style.translate && style.translate !== 'none') {
      const [tx, ty = '0px'] = style.translate.split(' ')
      matrix = matrix.translate(length(tx, width), length(ty, height))
    }
    if (style.rotate && style.rotate !== 'none') matrix = matrix.rotate(parseFloat(style.rotate))
    if (style.transform && style.transform !== 'none') matrix = matrix.multiply(new DOMMatrix(style.transform))
    matrix = matrix.translate(-ox, -oy)
    const outline = /polygon\((.*)\)/.exec(style.clipPath)?.[1].split(',') ?? ['0 0', '100% 0', '100% 100%', '0 100%']
    const polygon = outline.map((pair) => {
      const [x = '0', y = '0'] = pair.trim().split(/\s+/)
      const point = matrix.transformPoint(new DOMPoint(length(x, width), length(y, height)))
      return [point.x, point.y]
    })
    const pivot = matrix.transformPoint(new DOMPoint(ox, oy))
    const { across, down, ...exit } = EXITS[ink]
    return { ink, polygon, pivot: [pivot.x, pivot.y], exit: { ...exit, x: across * width, y: down * height } }
  })
}
