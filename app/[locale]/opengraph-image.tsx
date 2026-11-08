import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { getCallState } from '@/lib/call-state'
import { getFinalists, type Finalist } from '@/lib/finalists'
import { getSubmissionsCount } from '@/lib/submissions'
import { imageSrc } from '@/lib/image-src'
import { fmt, formatDayMonth, plural } from '@/lib/i18n/format'
import { isLocale, LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/locales'
import { MESSAGES } from '@/lib/i18n/messages'
import { site, getSiteUrl } from '@/lib/site'
import { BANNER_RATIO, BLUE, DOMAIN, INK, OG_SIZE, RED, banner, fonts, loadArtwork } from '@/lib/artwork-share-image'

export const alt = site.name
export const size = OG_SIZE
// JPEG, not PNG: with photos in it the PNG was ~600 KB, and WhatsApp tends to
// drop previews that heavy. Same conversion as lib/artwork-share-image.tsx.
export const contentType = 'image/jpeg'

// Hardcoded hex, not CSS var() — ImageResponse renders outside the app's
// stylesheet, so these are copied from the brand tokens in app/globals.css
// and must stay in sync with that file.
const PAPER = '#FAF8F2'
const YELLOW = '#E79D00'
const WHITE = '#FFFFFF'

const BAND_WIDTH = OG_SIZE.width
const BAND_HEIGHT = 150

// Jagged "torn paper" points, hand-tuned to echo the guide's poster series
// (logo on paper, torn blue/yellow cutout below) rather than satori's
// unsupported clip-path — see app/globals.css .torn-top for the CSS-only
// equivalent used elsewhere on the site. Drawn on a 200px-tall band and
// squeezed to BAND_HEIGHT.
const SQUEEZE = BAND_HEIGHT / 200
const LEFT = [
  [0, 18], [70, 4], [140, 22], [210, 6], [280, 28], [350, 10], [420, 34], [490, 16],
  [545, 60], [565, 120], [560, 200], [0, 200],
]
const tornPoints = (points: number[][], mirror: boolean) =>
  points.map(([x, y]) => `${mirror ? BAND_WIDTH - x : x},${Math.round(y * SQUEEZE)}`).join(' ')

// Where each obra of the pile sits in the right half (px from its top-left
// corner) and how it leans. Hand-placed like papers dropped on a table, the
// same way components/obras-collage.tsx stacks them on the home.
const PILE = [
  { left: 0, top: 150, rotate: -7, box: 230 },
  { left: 220, top: 30, rotate: 5, box: 250 },
  { left: 355, top: 225, rotate: -3, box: 225 },
  { left: 120, top: 270, rotate: 4, box: 210 },
  { left: 400, top: 15, rotate: -9, box: 165 },
] as const

// One obra per country, newest first, so the pile shows the "international"
// part of the name instead of five collages from the same place.
function pickForPile(finalists: Finalist[]) {
  const seen = new Set<string>()
  const picked: Finalist[] = []
  for (const finalist of finalists) {
    if (seen.has(finalist.countryCode)) continue
    seen.add(finalist.countryCode)
    picked.push(finalist)
    if (picked.length === PILE.length * 2) break
  }
  return picked
}

// The CDN already holds the 384px copy of any obra the home showed; the
// original upload (often a multi-MB phone photo) is the fallback.
async function loadPileArtwork(finalist: Finalist, box: number) {
  const small = imageSrc(finalist.imageUrl, 384)
  const resized = small.startsWith('/') ? `${getSiteUrl()}${small}` : small
  return (await loadArtwork(resized, { width: box, height: box })) ?? (await loadArtwork(finalist.imageUrl, { width: box, height: box }))
}

// Redrawn at most once an hour (it reads no request data, so the CDN serves
// it in between): each redraw is a satori render per language and an ISR
// write. The preview still follows the call's state, open with its deadline
// or closed: /admin/convocatoria redraws it when it changes. The obras are
// the published ones, read from the same cache as the home.
export const revalidate = 3600

// One per language, as the pages it previews (app/[locale]/layout.tsx).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE
  const m = MESSAGES[locale]

  const [{ open }, finalists, received] = await Promise.all([getCallState(), getFinalists(), getSubmissionsCount()])
  const countries = new Set(finalists.map((f) => f.countryCode)).size

  // Load a few more than the pile holds: an obra whose photo won't load is
  // skipped rather than leaving a hole.
  const candidates = pickForPile(finalists)
  const loaded = await Promise.all(candidates.map(async (finalist) => ({ art: await loadPileArtwork(finalist, 300) })))
  const pile = loaded.flatMap(({ art }) => (art ? [art] : [])).slice(0, PILE.length)

  const proof =
    received > 0 && countries > 0
      ? fmt(m.hero.proof, {
          artworks: plural(locale, received, m.map.artworks),
          countries: plural(locale, countries, m.hero.countries),
        })
      : null
  const line = open ? fmt(m.hero.free, { date: formatDayMonth(locale, site.deadlineISO) }) : null

  const png = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: PAPER, color: INK, fontFamily: 'Anton' }}>
        {/* Torn blue/yellow cutouts, as on the poster series and the home. */}
        <svg width={BAND_WIDTH} height={BAND_HEIGHT} viewBox={`0 0 ${BAND_WIDTH} ${BAND_HEIGHT}`} style={{ position: 'absolute', left: 0, bottom: 0 }}>
          <polygon points={tornPoints(LEFT, false)} fill={BLUE} />
          <polygon points={tornPoints(LEFT, true)} fill={YELLOW} />
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', width: pile.length ? 600 : 1200, padding: '56px 0 0 64px', alignItems: pile.length ? 'flex-start' : 'center' }}>
          { }
          <img src={banner} width={470} height={Math.round(470 * BANNER_RATIO)} alt="" />
          <div
            style={{
              display: 'flex',
              marginTop: 30,
              background: open ? BLUE : RED,
              color: PAPER,
              fontSize: 26,
              letterSpacing: 4,
              textTransform: 'uppercase',
              padding: '10px 24px',
              transform: 'rotate(-2deg)',
            }}
          >
            {open ? m.hero.badge : m.closed.badge}
          </div>
          {proof && (
            <div style={{ display: 'flex', marginTop: 26, fontSize: 40, lineHeight: 1.1, textTransform: 'uppercase', maxWidth: 520 }}>{proof}</div>
          )}
          {line && <div style={{ display: 'flex', marginTop: proof ? 14 : 26, fontSize: 24, letterSpacing: 1, opacity: 0.7 }}>{line}</div>}
          <div style={{ display: 'flex', marginTop: line ? 6 : proof ? 14 : 26, fontSize: 24, letterSpacing: 1, opacity: 0.7 }}>{DOMAIN}</div>
        </div>

        {/* The pile: real obras, each in a white paper frame like a print. */}
        {pile.length > 0 && (
          <div style={{ display: 'flex', position: 'absolute', left: 590, top: 40, width: 600, height: 560 }}>
            {pile.map((art, i) => {
              const slot = PILE[i]
              const scale = Math.min(slot.box / art.width, slot.box / art.height)
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    left: slot.left,
                    top: slot.top,
                    background: WHITE,
                    padding: 10,
                    transform: `rotate(${slot.rotate}deg)`,
                    boxShadow: '0 12px 28px rgba(27,17,12,0.30)',
                  }}
                >
                  { }
                  <img src={art.src} width={Math.round(art.width * scale)} height={Math.round(art.height * scale)} alt="" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts },
  )
  const body = await sharp(Buffer.from(await png.arrayBuffer()))
    .flatten({ background: PAPER })
    .jpeg({ quality: 85, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer()
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/jpeg' } })
}
