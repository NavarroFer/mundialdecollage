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
const TAPE = 'rgba(238,226,196,0.88)'

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
// Shapes, as SVG images: satori draws <img> SVGs through resvg.

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

// A ragged outline inside a w×h box: each side wanders `amp` px in from the
// edge, a step every `step` px or so.
function raggedOutline(w: number, h: number, amp: number, step: number, random: () => number) {
  const points: string[] = []
  const add = (x: number, y: number) => points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  const walk = (length: number, place: (along: number, depth: number) => void) => {
    for (let along = 0; along < length; along += step * (0.55 + random() * 0.9)) place(along, random() * amp)
  }
  walk(w, (x, d) => add(x, d))
  walk(h, (y, d) => add(w - d, y))
  walk(w, (x, d) => add(w - x, h - d))
  walk(h, (y, d) => add(d, h - y))
  return points.join(' ')
}

// A sheet of coloured paper torn on every side, with the white fibre a torn
// edge shows peeking out from under it.
function tornPaper(w: number, h: number, color: string, seed: number, scale = 1) {
  const random = seeded(seed)
  const amp = 9 * scale
  const fibre = raggedOutline(w, h, amp, 14 * scale, random)
  const inset = 4 * scale
  const sheet = raggedOutline(w - inset * 2, h - inset * 2, amp, 14 * scale, random)
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<polygon points="${fibre}" fill="#FFFFFF"/>` +
      `<g transform="translate(${inset} ${inset})"><polygon points="${sheet}" fill="${color}"/></g>` +
      `</svg>`,
  )
}

// A strip of masking tape: straight sides, zigzag ends where it was torn off.
function tape(w: number, h: number, seed: number) {
  const random = seeded(seed)
  const teeth = 6
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i <= teeth; i++) {
    const y = (h / teeth) * i
    left.push(`${(random() * h * 0.12).toFixed(1)},${y.toFixed(1)}`)
    right.unshift(`${(w - random() * h * 0.12).toFixed(1)},${y.toFixed(1)}`)
  }
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<polygon points="${[...left, ...right].join(' ')}" fill="${TAPE}"/></svg>`,
  )
}

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

// The torn edge of the site's labels (.torn-strip in app/globals.css), as a
// background stretched to the label: satori's clip-path misplaces it once
// the label is rotated.
const TORN_STRIP_POINTS =
  '0,8 6,0 12,9 18,2 24,10 30,3 36,11 42,2 48,9 54,0 60,10 66,3 72,11 78,2 84,9 90,0 96,10 100,3 100,93 94,100 88,91 82,98 76,90 70,100 64,91 58,98 52,90 46,100 40,91 34,98 28,90 22,100 16,91 10,98 4,90 0,97'
const tornStrip = (color: string) =>
  `url(${svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${TORN_STRIP_POINTS}" fill="${color}"/></svg>`)})`

type Box = { left?: number; top?: number; right?: number; bottom?: number }

function Paper({ src, w, h, at, rotate }: { src: string; w: number; h: number; at: Box; rotate: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={w} height={h} alt="" style={{ position: 'absolute', ...at, transform: `rotate(${rotate}deg)` }} />
  )
}

function Label({ text, color, fontSize, rotate = -2 }: { text: string; color: string; fontSize: number; rotate?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        backgroundImage: tornStrip(color),
        backgroundSize: '100% 100%',
        color: WHITE,
        fontFamily: DISPLAY,
        fontSize,
        letterSpacing: fontSize * 0.1,
        textTransform: 'uppercase',
        padding: `${fontSize * 0.42}px ${fontSize * 0.9}px`,
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
function PastedArtwork({ artwork, box, scale, rotate }: { artwork: Artwork; box: { width: number; height: number }; scale: number; rotate: number }) {
  const border = 12 * scale
  const w = artwork ? artwork.width : box.width * 0.8
  const h = artwork ? artwork.height : box.width * 0.8
  const tapeW = Math.min(150 * scale, w * 0.45)
  const tapeH = 40 * scale
  return (
    <div style={{ position: 'relative', display: 'flex', transform: `rotate(${rotate}deg)` }}>
      <div style={{ display: 'flex', background: WHITE, padding: border, boxShadow: `0 ${14 * scale}px ${30 * scale}px rgba(27,17,12,0.22)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artwork ? artwork.src : logoMark} width={w} height={h} alt="" />
      </div>
      <Paper src={tape(tapeW, tapeH, 7)} w={tapeW} h={tapeH} at={{ top: -tapeH * 0.45, left: -tapeW * 0.22 }} rotate={-32} />
      <Paper src={tape(tapeW, tapeH, 11)} w={tapeW} h={tapeH} at={{ bottom: -tapeH * 0.45, right: -tapeW * 0.22 }} rotate={-30} />
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

async function drawDiploma(d: Details, artwork: Artwork): Promise<Buffer> {
  const t = d.texts
  const qr = await QRCode.toDataURL(d.verifyUrl, { margin: 0, width: Math.round(120 * S), errorCorrectionLevel: 'M', color: { dark: INK, light: WHITE } })
  const [organizerA, organizerB] = d.organizers
  const sheet = { left: 96 * S, top: 84 * S, width: 1562 * S, height: 1072 * S }

  const image = new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', background: PAPER }}>
        {/* The coloured papers under the sheet, peeking out at the corners. */}
        <Paper src={tornPaper(640 * S, 420 * S, BLUE, 1, S)} w={640 * S} h={420 * S} at={{ left: -120 * S, top: -110 * S }} rotate={-7} />
        <Paper src={tornPaper(300 * S, 300 * S, YELLOW, 2, S)} w={300 * S} h={300 * S} at={{ right: -60 * S, top: -40 * S }} rotate={14} />
        <Paper src={tornPaper(660 * S, 430 * S, RED, 3, S)} w={660 * S} h={430 * S} at={{ right: -130 * S, bottom: -140 * S }} rotate={6} />
        <Paper src={tornPaper(900 * S, 86 * S, YELLOW, 4, S)} w={900 * S} h={86 * S} at={{ left: -80 * S, bottom: 70 * S }} rotate={-4} />

        {/* The white sheet everything is written on. */}
        <Paper src={tornPaper(sheet.width, sheet.height, WHITE, 5, S)} w={sheet.width} h={sheet.height} at={{ left: sheet.left, top: sheet.top }} rotate={-0.6} />

        <div style={{ position: 'absolute', left: sheet.left, top: sheet.top, width: sheet.width, height: sheet.height, display: 'flex', padding: `${64 * S}px ${80 * S}px ${54 * S}px ${70 * S}px` }}>
          {/* Left: the obra. */}
          <div style={{ display: 'flex', width: 520 * S, alignItems: 'center', justifyContent: 'center', paddingRight: 40 * S }}>
            <PastedArtwork artwork={artwork} box={{ width: 440 * S, height: 600 * S }} scale={S} rotate={-3} />
          </div>

          {/* Right: what it certifies. */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner} width={360 * S} height={360 * S * BANNER_RATIO} alt="" />
              <Stamp size={170 * S} edition={t.edition} background={WHITE} />
            </div>

            <div style={{ display: 'flex', marginTop: 22 * S }}>
              <Label text={t.title} color={RED} fontSize={30 * S} />
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
  return sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer()
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

export async function certificatePostImage(input: CertificateInput): Promise<{ png: Buffer; complete: boolean }> {
  const d = certificateDetails(input)
  const t = d.texts
  const artwork = await loadArtwork(input.finalist.imageUrl, { width: 520, height: 480 })
  const bannerWidth = 400

  const image = new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', background: PAPER, padding: '60px 64px 40px' }}>
        <Paper src={tornPaper(460, 320, BLUE, 21)} w={460} h={320} at={{ left: -120, top: -130 }} rotate={-9} />
        <Paper src={tornPaper(200, 200, YELLOW, 22)} w={200} h={200} at={{ right: -70, top: 170 }} rotate={16} />
        <Paper src={tornPaper(420, 300, RED, 23)} w={420} h={300} at={{ left: -220, bottom: -190 }} rotate={-6} />
        <Paper src={tornPaper(1240, 120, YELLOW, 24)} w={1240} h={120} at={{ left: -80, top: 560 }} rotate={-5} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner} width={bannerWidth} height={bannerWidth * BANNER_RATIO} alt="" />
        <div style={{ display: 'flex', marginTop: 18 }}>
          <Label text={t.title} color={RED} fontSize={26} />
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PastedArtwork artwork={artwork} box={{ width: 520, height: 480 }} scale={1} rotate={-3} />
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
  return { png: Buffer.from(await image.arrayBuffer()), complete: artwork !== null }
}
