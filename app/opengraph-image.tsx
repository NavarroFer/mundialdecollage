import { getCallState } from '@/lib/call-state'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { site } from '@/lib/site'

export const alt = site.name
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Hardcoded hex, not CSS var() — ImageResponse renders outside the app's
// stylesheet, so these are copied from the brand tokens in app/globals.css
// and must stay in sync with that file.
const PAPER = '#FAF8F2'
const INK = '#1B110C'
const BLUE = '#11458C'
const YELLOW = '#E79D00'

const BAND_WIDTH = 1200
const BAND_HEIGHT = 200

// Jagged "torn paper" points, hand-tuned to echo the guide's poster series
// (logo on paper, torn blue/yellow cutout below) rather than satori's
// unsupported clip-path — see app/globals.css .torn-top for the CSS-only
// equivalent used elsewhere on the site.
const LEFT_TORN_POINTS = [
  [0, 18],
  [70, 4],
  [140, 22],
  [210, 6],
  [280, 28],
  [350, 10],
  [420, 34],
  [490, 16],
  [545, 60],
  [565, 120],
  [560, BAND_HEIGHT],
  [0, BAND_HEIGHT],
]
  .map(([x, y]) => `${x},${y}`)
  .join(' ')

const RIGHT_TORN_POINTS = [
  [BAND_WIDTH, 18],
  [BAND_WIDTH - 70, 4],
  [BAND_WIDTH - 140, 22],
  [BAND_WIDTH - 210, 6],
  [BAND_WIDTH - 280, 28],
  [BAND_WIDTH - 350, 10],
  [BAND_WIDTH - 420, 34],
  [BAND_WIDTH - 490, 16],
  [BAND_WIDTH - 545, 60],
  [BAND_WIDTH - 565, 120],
  [BAND_WIDTH - 560, BAND_HEIGHT],
  [BAND_WIDTH, BAND_HEIGHT],
]
  .map(([x, y]) => `${x},${y}`)
  .join(' ')

function toDataUrl(publicPath: string) {
  const data = readFileSync(join(process.cwd(), 'public', publicPath)).toString('base64')
  return `data:image/png;base64,${data}`
}

// Redrawn at most once a minute (it reads no request data, so the CDN serves
// it in between) and the preview still follows the call's state
// (/admin/convocatoria): open with its deadline, or closed.
export const revalidate = 60

export default async function OpengraphImage() {
  const { open } = await getCallState()
  const banner = toDataUrl('banner-mundial.png')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 18,
          }}
        >
          {/* banner-mundial.png is 1290x388 (~3.32:1) — sized down keeping that ratio. */}
          <img src={banner} width={600} height={180} alt="" />
          <div
            style={{
              display: 'flex',
              marginTop: 8,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: INK,
            }}
          >
            {open ? 'Convocatoria abierta' : 'Convocatoria cerrada'}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: INK, opacity: 0.65 }}>
            {open ? `Hasta el ${site.deadlineLabel} · ` : 'Muy pronto, las finalistas · '}mundialdecollage.com.ar
          </div>
        </div>

        <div style={{ display: 'flex', width: BAND_WIDTH, height: BAND_HEIGHT }}>
          <svg width={BAND_WIDTH} height={BAND_HEIGHT} viewBox={`0 0 ${BAND_WIDTH} ${BAND_HEIGHT}`}>
            <polygon points={LEFT_TORN_POINTS} fill={BLUE} />
            <polygon points={RIGHT_TORN_POINTS} fill={YELLOW} />
          </svg>
        </div>
      </div>
    ),
    size,
  )
}
