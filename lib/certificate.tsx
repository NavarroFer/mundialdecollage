import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import sharp from 'sharp'
import type { Finalist } from '@/lib/finalists'
import { flagSvg } from '@/lib/flag-svg'
import { countryCodeToName } from '@/lib/participants'
import { site } from '@/lib/site'
import type { Locale } from '@/lib/i18n/locales'
import type { Messages } from '@/lib/i18n/messages'
import { fmt } from '@/lib/i18n/format'
import { BANNER_RATIO, BLUE, DOMAIN, INK, RED, banner, fonts, loadArtwork } from '@/lib/artwork-share-image'
import { paperLayer, stripImage, tapeImage, type Piece } from '@/lib/torn-paper'

// Participation certificates, one per obra (app/obras/[slug]/certificado):
// a printable A4 diploma (PDF) and a 1080x1350 image for an Instagram post.
// Artists get theirs once the call closes (lib/call-state.ts); admins can
// preview them any time.
//
// Same look as the site: flat blue, red and yellow papers torn at the edges,
// Anton for what's shouted, Geist for the rest, and the obra itself pasted
// on with tape. Every shape is drawn from a fixed seed, so the same input
// always gives the same picture — lib/certificate-cache.ts keeps it by a hash
// of that input.

// Same values as the brand tokens in app/globals.css.
const PAPER = '#FAF8F2'
const WHITE = '#FFFFFF'
const YELLOW = '#E79D00'

// Geist is the site's text face; it covers Polish and Cyrillic. Anton has no
// Cyrillic, so Russian falls back to Oswald, as on the site.
const geist = readFileSync(join(process.cwd(), 'assets/Geist-Regular.ttf'))
const allFonts = [...fonts, { name: 'Geist', data: geist, style: 'normal' as const, weight: 400 as const }]
const DISPLAY = 'Anton, Oswald'
const TEXT = 'Geist'
const logoMark = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/logo-mark.png')).toString('base64')}`

// Stable per obra and not guessable from the URL; printed on the diploma.
export function certificateCode(slug: string) {
  return `MIC-2026-${createHash('sha256').update(slug).digest('hex').slice(0, 6).toUpperCase()}`
}

// issuedISO: the date printed on it — the day the call closed (the route
// passes call_state.closed_at, or site.certificates.issuedISO before that).
export type CertificateInput = { finalist: Finalist; locale: Locale; m: Messages; verifyUrl: string; issuedISO: string }

/** Everything a certificate prints: what its cache key is made of. */
export function certificateDetails({ finalist, locale, m, issuedISO, verifyUrl }: CertificateInput) {
  return {
    name: finalist.name,
    country: finalist.countryCode ? countryCodeToName(finalist.countryCode, locale) : '',
    countryCode: finalist.countryCode ?? null,
    title: finalist.artworkTitle?.trim() || m.common.untitled,
    code: certificateCode(finalist.slug),
    date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
      .format(new Date(issuedISO)),
    texts: m.certificate,
    verifyUrl,
    organizers: site.organizers.map((organizer) => organizer.name),
  }
}

type Details = ReturnType<typeof certificateDetails>

// Long names and titles step down so they stay on one or two lines.
const fit = (text: string, base: number, long = 22, veryLong = 40) =>
  text.length > veryLong ? Math.round(base * 0.6) : text.length > long ? Math.round(base * 0.78) : base

// ---------------------------------------------------------------------------
// Shapes. The torn papers and the tape come from lib/torn-paper.ts (drawn
// with sharp, once per process); the rest are SVG images satori draws.

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

// A postage stamp: white, with perforated edges bitten out of it in the
// colour of what it's stuck on, and a red frame inside.
function stampSheet(size: number, background: string) {
  const r = size * 0.028
  const holes: string[] = []
  const count = 11
  for (let i = 0; i <= count; i++) {
    const at = (size / count) * i
    holes.push(`<circle cx="${at}" cy="0" r="${r}"/>`, `<circle cx="${at}" cy="${size}" r="${r}"/>`)
    holes.push(`<circle cx="0" cy="${at}" r="${r}"/>`, `<circle cx="${size}" cy="${at}" r="${r}"/>`)
  }
  const inner = size * 0.09
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" fill="#FFFFFF"/>` +
      `<g fill="${background}">${holes.join('')}</g>` +
      `<rect x="${inner}" y="${inner}" width="${size - inner * 2}" height="${size - inner * 2}" fill="none" stroke="${RED}" stroke-width="${size * 0.012}"/>` +
      `</svg>`,
  )
}

// A label on a torn strip of paper, like the site's .torn-strip
// (app/globals.css). The strip is drawn for the text's rough size, then
// stretched to the label.
function labelStrip(text: string, color: string, fontSize: number, scale: number) {
  const width = Math.round((text.length * fontSize * 0.66 + fontSize * 1.8) / (20 * scale)) * 20 * scale
  return stripImage(width, Math.round(fontSize * 1.9), color, 31, scale)
}

function Label({ text, strip, fontSize, rotate = -2 }: { text: string; strip: string; fontSize: number; rotate?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        backgroundImage: `url(${strip})`,
        backgroundSize: '100% 100%',
        color: WHITE,
        fontFamily: DISPLAY,
        fontSize,
        letterSpacing: fontSize * 0.1,
        textTransform: 'uppercase',
        padding: `${fontSize * 0.62}px ${fontSize * 1.05}px`,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {text}
    </div>
  )
}

function Flag({ code, height }: { code: string | null; height: number }) {
  const svg = code ? flagSvg(code) : null
  if (!svg) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={svgUri(svg)} width={height * 1.5} height={height} alt="" style={{ border: `${Math.max(1, height * 0.04)}px solid rgba(27,17,12,0.15)` }} />
}

type Artwork = Awaited<ReturnType<typeof loadArtwork>>

// The obra pasted on: a white border, a soft shadow and two strips of tape.
// Without its photo (it couldn't be loaded) the Mundial's globe stands in.
type Tape = Awaited<ReturnType<typeof tapeImage>>

function tapesFor(scale: number) {
  return Promise.all([tapeImage(Math.round(150 * scale), Math.round(40 * scale), 7, scale), tapeImage(Math.round(150 * scale), Math.round(40 * scale), 11, scale)])
}

function PastedArtwork({ artwork, box, scale, rotate, tapes }: { artwork: Artwork; box: { width: number; height: number }; scale: number; rotate: number; tapes: Tape[] }) {
  const border = 12 * scale
  const w = artwork ? artwork.width : box.width * 0.8
  const h = artwork ? artwork.height : box.width * 0.8
  const [first, second] = tapes
  return (
    <div style={{ position: 'relative', display: 'flex', transform: `rotate(${rotate}deg)` }}>
      <div style={{ display: 'flex', background: WHITE, padding: border, boxShadow: `0 ${3 * scale}px ${4 * scale}px rgba(27,17,12,0.18), 0 ${14 * scale}px ${30 * scale}px rgba(27,17,12,0.2)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artwork ? artwork.src : logoMark} width={w} height={h} alt="" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={first.src} width={first.width} height={first.height} alt="" style={{ position: 'absolute', top: -first.height * 0.45, left: -first.width * 0.25, transform: 'rotate(-32deg)' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={second.src} width={second.width} height={second.height} alt="" style={{ position: 'absolute', bottom: -second.height * 0.45, right: -second.width * 0.25, transform: 'rotate(-30deg)' }} />
    </div>
  )
}

// The postage stamp seal: the globe and the edition.
function Stamp({ size, edition, background }: { size: number; edition: string; background: string }) {
  return (
    <div style={{ position: 'relative', display: 'flex', width: size, height: size, transform: 'rotate(5deg)', boxShadow: `0 ${size * 0.03}px ${size * 0.07}px rgba(27,17,12,0.18)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stampSheet(size, background)} width={size} height={size} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoMark} width={size * 0.46} height={size * 0.46} alt="" />
        <div style={{ display: 'flex', marginTop: size * 0.05, maxWidth: size * 0.72, justifyContent: 'center', textAlign: 'center', fontFamily: DISPLAY, fontSize: size * 0.1, lineHeight: 1.1, letterSpacing: size * 0.004, color: RED, textTransform: 'uppercase' }}>{edition}</div>
      </div>
    </div>
  )
}

function Signature({ name, role, width, scale }: { name: string; role: string; width: number; scale: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width }}>
      <div style={{ display: 'flex', width: '100%', borderTop: `${2 * scale}px solid ${INK}` }} />
      <div style={{ display: 'flex', marginTop: 10 * scale, fontFamily: DISPLAY, fontSize: 26 * scale, letterSpacing: 1 * scale, color: INK, textTransform: 'uppercase' }}>{name}</div>
      <div style={{ display: 'flex', fontFamily: TEXT, fontSize: 18 * scale, color: INK, opacity: 0.65 }}>{role}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The A4 diploma.

// A4 landscape at 300 dpi, laid out in half-size units.
export const DIPLOMA = { width: 3508, height: 2480 }
const S = DIPLOMA.width / 1754

// The papers under the text, the same on every diploma: blue and yellow
// peeking out at the top, red at the bottom right, a yellow strip along the
// bottom, and the white sheet it's all written on, a little crooked.
const SHEET = { left: 96 * S, top: 84 * S, width: 1562 * S, height: 1072 * S }
const DIPLOMA_PAPERS: Piece[] = [
  { x: 200 * S, y: 100 * S, w: 640 * S, h: 420 * S, rotate: -7, color: BLUE, seed: 1 },
  { x: 1664 * S, y: 110 * S, w: 300 * S, h: 300 * S, rotate: 14, color: YELLOW, seed: 2 },
  { x: 1554 * S, y: 1165 * S, w: 660 * S, h: 430 * S, rotate: 6, color: RED, seed: 3, torn: { left: false } },
  { x: 370 * S, y: 1127 * S, w: 900 * S, h: 86 * S, rotate: -4, color: YELLOW, seed: 4, torn: { left: false, right: false }, fibre: 6 },
  { x: SHEET.left + SHEET.width / 2, y: SHEET.top + SHEET.height / 2, w: SHEET.width, h: SHEET.height, rotate: -0.6, color: WHITE, seed: 5, fibre: 3, texture: 0 },
]

async function drawDiploma(d: Details, artwork: Artwork): Promise<Buffer> {
  const t = d.texts
  const [qr, tapes, papers, strip] = await Promise.all([
    QRCode.toDataURL(d.verifyUrl, { margin: 0, width: Math.round(120 * S), errorCorrectionLevel: 'M', color: { dark: INK, light: WHITE } }),
    tapesFor(S),
    paperLayer(DIPLOMA.width, DIPLOMA.height, PAPER, DIPLOMA_PAPERS, S),
    labelStrip(t.title, RED, 30 * S, S),
  ])
  const [organizerA, organizerB] = d.organizers
  const sheet = SHEET

  // Only the writing and the obra: drawn on a transparent page and laid on
  // the papers below.
  const image = new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', left: sheet.left, top: sheet.top, width: sheet.width, height: sheet.height, display: 'flex', padding: `${64 * S}px ${80 * S}px ${54 * S}px ${70 * S}px` }}>
          {/* Left: the obra. */}
          <div style={{ display: 'flex', width: 520 * S, alignItems: 'center', justifyContent: 'center', paddingRight: 40 * S }}>
            <PastedArtwork artwork={artwork} box={{ width: 440 * S, height: 600 * S }} scale={S} rotate={-3} tapes={tapes} />
          </div>

          {/* Right: what it certifies. */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner} width={360 * S} height={360 * S * BANNER_RATIO} alt="" />
              <Stamp size={170 * S} edition={t.edition} background={WHITE} />
            </div>

            <div style={{ display: 'flex', marginTop: 22 * S }}>
              <Label text={t.title} strip={strip} fontSize={30 * S} />
            </div>

            <div style={{ display: 'flex', marginTop: 34 * S, fontFamily: TEXT, fontSize: 26 * S, color: INK, opacity: 0.7 }}>{t.certifies}</div>
            <div style={{ display: 'flex', marginTop: 6 * S, maxWidth: 880 * S, fontFamily: DISPLAY, fontSize: fit(d.name, 112 * S), lineHeight: 1.02, color: INK, textTransform: 'uppercase' }}>{d.name}</div>
            {d.country && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 * S, marginTop: 14 * S }}>
                <Flag code={d.countryCode} height={26 * S} />
                <div style={{ display: 'flex', fontFamily: TEXT, fontSize: 24 * S, letterSpacing: 4 * S, color: INK, textTransform: 'uppercase' }}>{d.country}</div>
              </div>
            )}

            <div style={{ display: 'flex', marginTop: 36 * S, maxWidth: 880 * S, fontFamily: TEXT, fontSize: 28 * S, lineHeight: 1.4, color: INK }}>{t.participated}</div>
            <div style={{ display: 'flex', marginTop: 8 * S, maxWidth: 880 * S, fontFamily: DISPLAY, fontSize: fit(d.title, 60 * S, 30, 56), lineHeight: 1.1, color: BLUE, textTransform: 'uppercase' }}>{d.title}</div>

            {/* Signatures, then the date and how to check it's real. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 60 * S, marginTop: 'auto' }}>
              <Signature name={organizerA} role={t.organization} width={300 * S} scale={S} />
              <Signature name={organizerB} role={t.organization} width={300 * S} scale={S} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26 * S, fontFamily: TEXT, fontSize: 19 * S, color: INK }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex' }}>{`${t.place} · ${d.date}`}</div>
                <div style={{ display: 'flex', marginTop: 4 * S, opacity: 0.7 }}>{`${fmt(t.number, { code: d.code })} · ${t.verify} ${DOMAIN}`}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} width={84 * S} height={84 * S} alt="" />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...DIPLOMA, fonts: allFonts },
  )
  return sharp(papers)
    .composite([{ input: Buffer.from(await image.arrayBuffer()) }])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer()
}

/** The diploma as a 300 dpi JPEG; `complete` is false when the obra's photo couldn't be loaded. */
export async function diplomaJpeg(input: CertificateInput): Promise<{ jpeg: Buffer; complete: boolean }> {
  const artwork = await loadArtwork(input.finalist.imageUrl, { width: Math.round(420 * S), height: Math.round(560 * S) })
  return { jpeg: await drawDiploma(certificateDetails(input), artwork), complete: artwork !== null }
}

const PT = 72 / 25.4
const A4_LANDSCAPE = { width: 297 * PT, height: 210 * PT }

export async function diplomaPdf(jpeg: Buffer, input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${input.m.certificate.title} — ${input.finalist.name} | Mundial de Collage`)
  pdf.setCreator('Mundial de Collage')
  const page = pdf.addPage([A4_LANDSCAPE.width, A4_LANDSCAPE.height])
  const image = await pdf.embedJpg(jpeg)
  page.drawImage(image, { x: 0, y: 0, ...A4_LANDSCAPE })
  return pdf.save()
}

/** A smaller copy of the diploma for the certificate page. */
export function diplomaPreview(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg).resize({ width: 1600 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
}

// ---------------------------------------------------------------------------
// The Instagram post. 4:5, the tallest a feed post shows uncropped.

export const POST_SIZE = { width: 1080, height: 1350 }

const POST_PAPERS: Piece[] = [
  { x: 110, y: 30, w: 460, h: 320, rotate: -9, color: BLUE, seed: 21 },
  { x: 1050, y: 270, w: 200, h: 200, rotate: 16, color: YELLOW, seed: 22 },
  { x: -10, y: 1390, w: 420, h: 300, rotate: -6, color: RED, seed: 23 },
  { x: 540, y: 620, w: 1240, h: 120, rotate: -5, color: YELLOW, seed: 24, torn: { left: false, right: false }, fibre: 6 },
]

export async function certificatePostImage(input: CertificateInput): Promise<{ png: Buffer; complete: boolean }> {
  const d = certificateDetails(input)
  const t = d.texts
  const [artwork, tapes, papers, strip] = await Promise.all([
    loadArtwork(input.finalist.imageUrl, { width: 520, height: 480 }),
    tapesFor(1),
    paperLayer(POST_SIZE.width, POST_SIZE.height, PAPER, POST_PAPERS),
    labelStrip(t.title, RED, 26, 1),
  ])
  const bannerWidth = 400

  const image = new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '60px 64px 40px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner} width={bannerWidth} height={bannerWidth * BANNER_RATIO} alt="" />
        <div style={{ display: 'flex', marginTop: 18 }}>
          <Label text={t.title} strip={strip} fontSize={26} />
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PastedArtwork artwork={artwork} box={{ width: 520, height: 480 }} scale={1} rotate={-3} tapes={tapes} />
        </div>

        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 92, lineHeight: 1, color: INK, textTransform: 'uppercase' }}>{t.igBadge}</div>
        <div style={{ display: 'flex', marginTop: 8, maxWidth: 900, justifyContent: 'center', textAlign: 'center', fontFamily: TEXT, fontSize: 30, color: INK }}>{t.igLine}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
          <Flag code={d.countryCode} height={30} />
          <div style={{ display: 'flex', maxWidth: 820, fontFamily: DISPLAY, fontSize: fit(d.name, 46, 26, 44), color: INK, textTransform: 'uppercase' }}>{d.name}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 4, maxWidth: 900, justifyContent: 'center', textAlign: 'center', fontFamily: TEXT, fontSize: fit(d.title, 30, 36, 70), color: BLUE }}>{`«${d.title}»`}</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, color: INK }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 30, letterSpacing: 1 }}>{DOMAIN}</div>
          <div style={{ display: 'flex', fontFamily: TEXT, fontSize: 18, opacity: 0.65 }}>{fmt(t.number, { code: d.code })}</div>
        </div>
      </div>
    ),
    { ...POST_SIZE, fonts: allFonts },
  )
  const png = await sharp(papers).composite([{ input: Buffer.from(await image.arrayBuffer()) }]).png().toBuffer()
  return { png, complete: artwork !== null }
}
