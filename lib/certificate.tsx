import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import sharp from 'sharp'
import type { Finalist } from '@/lib/finalists'
import { countryCodeToName } from '@/lib/participants'
import { site } from '@/lib/site'
import type { Locale } from '@/lib/i18n/locales'
import type { Messages } from '@/lib/i18n/messages'
import { fmt } from '@/lib/i18n/format'
import { BANNER_RATIO, BLUE, DOMAIN, INK, RED, banner, fonts, loadArtwork } from '@/lib/artwork-share-image'

// Participation certificates, one per obra (app/obras/[slug]/certificado):
// a printable A4 diploma (PDF) and a 1080x1350 image for an Instagram post.
// Gated by site.certificates.enabled.

const PAPER = '#FBF7EC'
const GOLD = '#A8832F'
const YELLOW = '#E79D00'

// EB Garamond for the diploma's formal voice; subsets for Latin, the
// extended Latin Polish needs, and Cyrillic.
const garamond = (file: string) => readFileSync(join(process.cwd(), 'assets', file))
const serifFonts = [
  { name: 'Garamond', data: garamond('EBGaramond-latin-400-normal.woff'), style: 'normal' as const, weight: 400 as const },
  { name: 'GaramondExt', data: garamond('EBGaramond-latin-ext-400-normal.woff'), style: 'normal' as const, weight: 400 as const },
  { name: 'GaramondCyr', data: garamond('EBGaramond-cyrillic-400-normal.woff'), style: 'normal' as const, weight: 400 as const },
  { name: 'Garamond', data: garamond('EBGaramond-latin-400-italic.woff'), style: 'italic' as const, weight: 400 as const },
  { name: 'GaramondExt', data: garamond('EBGaramond-latin-ext-400-italic.woff'), style: 'italic' as const, weight: 400 as const },
  { name: 'GaramondCyr', data: garamond('EBGaramond-cyrillic-400-italic.woff'), style: 'italic' as const, weight: 400 as const },
  { name: 'Garamond', data: garamond('EBGaramond-latin-600-normal.woff'), style: 'normal' as const, weight: 600 as const },
  { name: 'GaramondExt', data: garamond('EBGaramond-latin-ext-600-normal.woff'), style: 'normal' as const, weight: 600 as const },
  { name: 'GaramondCyr', data: garamond('EBGaramond-cyrillic-600-normal.woff'), style: 'normal' as const, weight: 600 as const },
]
const allFonts = [...fonts, ...serifFonts]
// Each subset is its own family so satori falls through them in order.
const SERIF = 'Garamond, GaramondExt, GaramondCyr'
const logoMark = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/logo-mark.png')).toString('base64')}`

// Stable per obra and not guessable from the URL; printed on the diploma.
export function certificateCode(slug: string) {
  return `MIC-2026-${createHash('sha256').update(slug).digest('hex').slice(0, 6).toUpperCase()}`
}

export type CertificateInput = { finalist: Finalist; locale: Locale; m: Messages; verifyUrl: string }

function details({ finalist, locale, m }: CertificateInput) {
  return {
    name: finalist.name,
    country: countryCodeToName(finalist.countryCode, locale),
    title: finalist.artworkTitle ?? m.common.untitled,
    code: certificateCode(finalist.slug),
    date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
      .format(new Date(site.certificates.issuedISO)),
  }
}

// Long names and titles step down so they stay on one or two lines.
const fit = (text: string, base: number, long = 28, veryLong = 48) =>
  text.length > veryLong ? Math.round(base * 0.62) : text.length > long ? Math.round(base * 0.8) : base

// A round seal: the Mundial's globe inside two rings.
function Seal({ size, label }: { size: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: size, border: `${size * 0.03}px solid ${GOLD}`, background: PAPER }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: size * 0.86, height: size * 0.86, borderRadius: size, border: `${size * 0.012}px dashed ${GOLD}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoMark} width={size * 0.46} height={size * 0.46} alt="" />
        <div style={{ display: 'flex', marginTop: size * 0.04, fontFamily: 'Anton', fontSize: size * 0.085, letterSpacing: size * 0.012, color: INK, textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  )
}

function Signature({ name, role, width, scale }: { name: string; role: string; width: number; scale: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width }}>
      <div style={{ display: 'flex', width: '100%', borderTop: `${2 * scale}px solid ${INK}` }} />
      <div style={{ display: 'flex', marginTop: 14 * scale, fontFamily: SERIF, fontWeight: 600, fontSize: 30 * scale, color: INK }}>{name}</div>
      <div style={{ display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontSize: 24 * scale, color: INK, opacity: 0.75 }}>{role}</div>
    </div>
  )
}

// A4 landscape at 300 dpi.
const DIPLOMA = { width: 3508, height: 2480 }

async function diplomaImage(input: CertificateInput): Promise<Buffer> {
  const { m } = input
  const t = m.certificate
  const d = details(input)
  const s = DIPLOMA.width / 1754 // layout in "half-size" units
  const qr = await QRCode.toDataURL(input.verifyUrl, { margin: 0, width: Math.round(150 * s), errorCorrectionLevel: 'M', color: { dark: INK, light: PAPER } })
  const [organizerA, organizerB] = site.organizers
  const bannerWidth = 520 * s

  const image = new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, padding: 46 * s }}>
        {/* Outer rule and inner hairline, like an engraved border. */}
        <div style={{ display: 'flex', flex: 1, border: `${7 * s}px solid ${INK}`, padding: 10 * s }}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, border: `${2 * s}px solid ${GOLD}`, padding: `${44 * s}px ${90 * s}px ${36 * s}px` }}>
            {/* Paper scraps in the corners: the collage in an official frame. */}
            <div style={{ position: 'absolute', top: -14 * s, left: -14 * s, width: 70 * s, height: 46 * s, background: RED, transform: 'rotate(-8deg)' }} />
            <div style={{ position: 'absolute', top: -10 * s, right: -16 * s, width: 58 * s, height: 58 * s, background: BLUE, transform: 'rotate(12deg)' }} />
            <div style={{ position: 'absolute', bottom: -14 * s, left: -12 * s, width: 56 * s, height: 56 * s, background: YELLOW, transform: 'rotate(10deg)' }} />
            <div style={{ position: 'absolute', bottom: -12 * s, right: -14 * s, width: 74 * s, height: 44 * s, background: RED, transform: 'rotate(-6deg)' }} />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} width={bannerWidth} height={bannerWidth * BANNER_RATIO} alt="" />
            <div style={{ display: 'flex', marginTop: 18 * s, fontFamily: 'Anton', fontSize: 66 * s, letterSpacing: 8 * s, color: INK, textTransform: 'uppercase' }}>{t.title}</div>
            <div style={{ display: 'flex', marginTop: 4 * s, fontFamily: SERIF, fontSize: 28 * s, letterSpacing: 6 * s, color: GOLD, textTransform: 'uppercase' }}>{t.edition}</div>

            <div style={{ display: 'flex', marginTop: 34 * s, fontFamily: SERIF, fontStyle: 'italic', fontSize: 34 * s, color: INK }}>{t.certifies}</div>
            <div style={{ display: 'flex', marginTop: 6 * s, maxWidth: 1300 * s, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: fit(d.name, 92 * s), lineHeight: 1.1, color: INK }}>{d.name}</div>
            <div style={{ display: 'flex', width: 760 * s, marginTop: 10 * s, borderTop: `${2 * s}px solid ${GOLD}` }} />
            <div style={{ display: 'flex', marginTop: 10 * s, fontFamily: SERIF, fontSize: 28 * s, letterSpacing: 4 * s, color: INK, opacity: 0.8, textTransform: 'uppercase' }}>{d.country}</div>

            <div style={{ display: 'flex', marginTop: 28 * s, maxWidth: 1180 * s, textAlign: 'center', fontFamily: SERIF, fontSize: 34 * s, lineHeight: 1.35, color: INK }}>{t.participated}</div>
            <div style={{ display: 'flex', marginTop: 6 * s, maxWidth: 1180 * s, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: fit(d.title, 46 * s, 36, 70), color: BLUE }}>«{d.title}»</div>

            {/* Signatures either side of the seal. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginTop: 'auto' }}>
              <Signature name={organizerA.name} role={t.organization} width={360 * s} scale={s} />
              <Seal size={230 * s} label="2026" />
              <Signature name={organizerB.name} role={t.organization} width={360 * s} scale={s} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 22 * s, fontFamily: SERIF, fontSize: 22 * s, color: INK }}>
              <div style={{ display: 'flex' }}>{`${t.place} · ${d.date}`}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 * s }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', fontWeight: 600 }}>{fmt(t.number, { code: d.code })}</div>
                  <div style={{ display: 'flex', opacity: 0.75 }}>{`${t.verify} ${DOMAIN}`}</div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} width={78 * s} height={78 * s} alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...DIPLOMA, fonts: allFonts },
  )
  return sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 92 }).toBuffer()
}

const PT = 72 / 25.4
const A4_LANDSCAPE = { width: 297 * PT, height: 210 * PT }

export async function certificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${input.m.certificate.title} — ${input.finalist.name} | Mundial de Collage`)
  pdf.setCreator('Mundial de Collage')
  const page = pdf.addPage([A4_LANDSCAPE.width, A4_LANDSCAPE.height])
  const image = await pdf.embedJpg(await diplomaImage(input))
  page.drawImage(image, { x: 0, y: 0, ...A4_LANDSCAPE })
  return pdf.save()
}

// 4:5, the tallest an Instagram feed post shows uncropped.
export const POST_SIZE = { width: 1080, height: 1350 }

export async function certificatePostImage(input: CertificateInput) {
  const { m } = input
  const t = m.certificate
  const d = details(input)
  const artwork = await loadArtwork(input.finalist.imageUrl, { width: 560, height: 520 })
  const bannerWidth = 420

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, padding: 34 }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, border: `5px solid ${INK}`, padding: '36px 48px 30px' }}>
          <div style={{ position: 'absolute', top: -12, left: -12, width: 56, height: 36, background: RED, transform: 'rotate(-8deg)' }} />
          <div style={{ position: 'absolute', bottom: -12, right: -12, width: 48, height: 48, background: BLUE, transform: 'rotate(10deg)' }} />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} width={bannerWidth} height={bannerWidth * BANNER_RATIO} alt="" />
          <div style={{ display: 'flex', marginTop: 16, background: RED, color: '#FFFFFF', fontFamily: 'Anton', fontSize: 30, letterSpacing: 4, padding: '8px 22px', textTransform: 'uppercase', transform: 'rotate(-2deg)' }}>{t.title}</div>

          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 22 }}>
            {artwork && (
              <div style={{ display: 'flex', background: '#FFFFFF', padding: 16, transform: 'rotate(-2deg)', boxShadow: '0 16px 36px rgba(27,17,12,0.25)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artwork.src} width={artwork.width} height={artwork.height} alt="" />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', marginTop: 24, fontFamily: 'Anton', fontSize: 62, color: INK, textTransform: 'uppercase' }}>{t.igBadge}</div>
          <div style={{ display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontSize: 34, color: INK, textAlign: 'center' }}>{t.igLine}</div>
          <div style={{ display: 'flex', marginTop: 14, maxWidth: 900, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: fit(d.name, 46), color: INK }}>{d.name}</div>
          <div style={{ display: 'flex', maxWidth: 900, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: fit(d.title, 32, 36, 70), color: BLUE }}>{`«${d.title}» · ${d.country}`}</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 20, fontFamily: SERIF, fontSize: 22, color: INK }}>
            <div style={{ display: 'flex', fontWeight: 600 }}>{fmt(t.number, { code: d.code })}</div>
            <div style={{ display: 'flex', fontFamily: 'Anton', fontSize: 26, letterSpacing: 1 }}>{DOMAIN}</div>
          </div>
        </div>
      </div>
    ),
    { ...POST_SIZE, fonts: allFonts },
  )
}
