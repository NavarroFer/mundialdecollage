import { galleryThemes, type GalleryTheme } from '@/components/gallery/themes'
import { framePresentation } from '@/components/gallery/artwork/frameStyles'
import type { GalleryFrameStyle } from '@/data/artworks'

// Small drawings of what each editor option looks like in the 3D room, in
// the colors the room itself uses (components/gallery), so a member can
// choose by eye. Pure markup: no images to load, nothing drawn per request.

// The piece of art inside a preview frame: the member's own obra when there
// is one, else a scrap of collage.
function Art({ src }: { src?: string | null }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element -- a 40px thumbnail already served by next/image elsewhere on the page
    ? <img src={src} alt="" className="h-full w-full object-cover" />
    : <div className="h-full w-full bg-[linear-gradient(135deg,#d84b38_0_35%,#f2c14e_35%_60%,#2f5fa7_60%)]" />
}

/** A wall, floor and one framed piece in a theme's colors. */
export function ThemePreview({ theme, art }: { theme: GalleryTheme; art?: string | null }) {
  const { room, frame } = galleryThemes[theme]
  return (
    <div aria-hidden className="relative aspect-[4/3] w-full overflow-hidden rounded-lg" style={{ background: room.wall }}>
      <div className="absolute inset-x-0 bottom-0 h-[28%]" style={{ background: room.floor, borderTop: `3px solid ${room.trim}` }} />
      <div className="absolute top-[16%] left-1/2 h-[44%] w-[36%] -translate-x-1/2 p-[4%] shadow-md" style={{ background: frame.outer }}>
        <div className="h-full w-full p-[10%]" style={{ background: frame.mat }}><Art src={art} /></div>
      </div>
    </div>
  )
}

/** One piece in a frame style, hung on the member's current wall. */
export function FramePreview({ style, theme, art }: { style: GalleryFrameStyle; theme: GalleryTheme; art?: string | null }) {
  const look = framePresentation(style, theme)
  const pinned = style === 'pinned'
  return (
    <div aria-hidden className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg" style={{ background: galleryThemes[theme].room.wall }}>
      <div
        className={`relative h-[70%] w-[46%] ${pinned ? 'rotate-[-2deg] shadow-sm' : 'shadow-md'}`}
        style={pinned ? undefined : {
          padding: `${Math.round(look.border * 120)}px`,
          background: style === 'gold' ? `linear-gradient(135deg, #e3c77a, ${look.outer} 45%, #7a5b22)` : look.outer,
        }}
      >
        <div className="h-full w-full" style={pinned ? undefined : { padding: `${Math.round(look.matMargin * 90)}px`, background: look.mat }}><Art src={art} /></div>
        {pinned && ['left-1 top-1', 'right-1 top-1'].map((corner) => <span key={corner} className={`absolute ${corner} h-1.5 w-1.5 rounded-full bg-collage-red shadow`} />)}
      </div>
    </div>
  )
}

/** A wall with one mark per place to hang an obra. */
export function RoomPreview({ capacity, filled = 0 }: { capacity: number; filled?: number }) {
  return (
    <div aria-hidden className="flex aspect-[4/3] w-full flex-wrap content-center items-center justify-center gap-1 rounded-lg bg-muted p-3">
      {Array.from({ length: capacity }, (_, index) => (
        <span key={index} className={`h-3.5 w-2.5 rounded-[2px] ${index < filled ? 'bg-ink' : 'border border-ink/30 bg-background'}`} />
      ))}
    </div>
  )
}
