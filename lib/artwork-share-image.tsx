import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import type { Finalist } from '@/lib/finalists'
import { countryCodeToName } from '@/lib/participants'
import { site } from '@/lib/site'
import type { Locale } from '@/lib/i18n/locales'
import type { Messages } from '@/lib/i18n/messages'
import { fmt, formatDayMonth } from '@/lib/i18n/format'

// The picture an obra travels with: the link preview of /obras/[slug]
// (opengraph-image.tsx next to it) and the image for Instagram stories
// (/obras/[slug]/historia). Each one an artist posts is an invitation, so
// both carry the free-entry call to action and the site's address.

// Hardcoded hex, not CSS var() — ImageResponse renders outside the app's
// stylesheet; same values as the brand tokens in app/globals.css.
const PAPER = '#FAF8F2'
const INK = '#1B110C'
const BLUE = '#11458C'
const RED = '#D4302E'
const WHITE = '#FFFFFF'

const DOMAIN = 'mundialdecollage.com.ar'

// Read once: none depends on the request. Anton has no Cyrillic, so Russian
// falls back to Oswald, as on the site (app/layout.tsx).
const anton = readFileSync(join(process.cwd(), 'assets/Anton-Regular.ttf'))
const oswaldCyrillic = readFileSync(join(process.cwd(), 'assets/Oswald-Cyrillic-700.woff'))
const banner = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/banner-mundial.png')).toString('base64')}`
// banner-mundial.png is 1290x388.
const BANNER_RATIO = 388 / 1290

export const OG_SIZE = { width: 1200, height: 630 }
export const STORY_SIZE = { width: 1080, height: 1920 }

type Box = { width: number; height: number }

// Uploads can be WEBP, GIF or huge JPEGs, none of which the image renderer
// takes as is: sharp turns the obra into a JPEG that fits the frame.
async function loadArtwork(url: string, box: Box): Promise<(Box & { src: string }) | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
      .rotate()
      .resize({ width: box.width, height: box.height, fit: 'inside' })
      .flatten({ background: WHITE })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    return { src: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height }
  } catch {
    return null
  }
}

// Long titles step down so they still fit in a few lines.
function titleSize(title: string, base: number) {
  if (title.length > 60) return Math.round(base * 0.55)
  if (title.length > 32) return Math.round(base * 0.72)
  return base
}

function Badge({ label, fontSize }: { label: string; fontSize: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        background: RED,
        color: WHITE,
        fontSize,
        letterSpacing: fontSize * 0.12,
        textTransform: 'uppercase',
        padding: `${fontSize * 0.35}px ${fontSize * 0.8}px`,
        transform: 'rotate(-2deg)',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  )
}

function Frame({ artwork, padding }: { artwork: Box & { src: string }; padding: number }) {
  return (
    <div
      style={{
        display: 'flex',
        background: WHITE,
        padding,
        transform: 'rotate(-2deg)',
        boxShadow: '0 18px 40px rgba(27,17,12,0.28)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artwork.src} width={artwork.width} height={artwork.height} alt="" />
    </div>
  )
}

type Input = { finalist: Finalist; locale: Locale; m: Messages }

function details({ finalist, locale, m }: Input) {
  return {
    title: finalist.artworkTitle ?? m.common.untitled,
    artist: `${finalist.name} · ${countryCodeToName(finalist.countryCode, locale)}`,
    cta: fmt(m.share.cta, { date: formatDayMonth(locale, site.deadlineISO) }),
  }
}

const fonts = [
  { name: 'Anton', data: anton, style: 'normal' as const, weight: 400 as const },
  { name: 'Oswald', data: oswaldCyrillic, style: 'normal' as const, weight: 400 as const },
]

export async function artworkOgImage(input: Input) {
  const { title, artist, cta } = details(input)
  const artwork = await loadArtwork(input.finalist.imageUrl, { width: 470, height: 500 })

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: PAPER, color: INK }}>
        <div style={{ display: 'flex', width: 560, alignItems: 'center', justifyContent: 'center' }}>
          {artwork && <Frame artwork={artwork} padding={14} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '52px 56px 44px 16px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} width={330} height={Math.round(330 * BANNER_RATIO)} alt="" />
          <div style={{ display: 'flex', marginTop: 34 }}>
            <Badge label={input.m.share.badge} fontSize={20} />
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 22,
              fontFamily: 'Anton',
              fontSize: titleSize(title, 66),
              lineHeight: 1.05,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', marginTop: 16, fontSize: 28, fontWeight: 700 }}>{artist}</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: BLUE }}>{cta}</div>
          <div style={{ display: 'flex', marginTop: 6, fontSize: 22, opacity: 0.65 }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  )
}

export async function artworkStoryImage(input: Input) {
  const { title, artist, cta } = details(input)
  const artwork = await loadArtwork(input.finalist.imageUrl, { width: 820, height: 620 })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: PAPER,
          color: INK,
        }}
      >
        {/* Top and bottom margins keep clear of Instagram's own story bars. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner} width={640} height={Math.round(640 * BANNER_RATIO)} alt="" style={{ marginTop: 180 }} />
        <div style={{ display: 'flex', marginTop: 44 }}>
          <Badge label={input.m.share.badge} fontSize={30} />
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {artwork && <Frame artwork={artwork} padding={22} />}
        </div>
        <div
          style={{
            display: 'flex',
            maxWidth: 920,
            textAlign: 'center',
            justifyContent: 'center',
            fontFamily: 'Anton',
            fontSize: titleSize(title, 88),
            lineHeight: 1.05,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', maxWidth: 920, marginTop: 18, fontSize: 40, textAlign: 'center', justifyContent: 'center' }}>
          {artist}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            marginTop: 64,
            padding: '44px 40px 200px',
            background: BLUE,
            color: WHITE,
          }}
        >
          <div style={{ display: 'flex', fontFamily: 'Anton', fontSize: 50, textTransform: 'uppercase', textAlign: 'center' }}>
            {cta}
          </div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 36, opacity: 0.85 }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    { ...STORY_SIZE, fonts },
  )
}
