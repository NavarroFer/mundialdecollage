import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { PDFDocument, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { BRAND_TARGET_PATH } from '@/lib/ar/targets'
import { BANNER_RATIO, BLUE, DOMAIN, INK, RED, banner, fonts, loadArtwork } from '@/lib/artwork-share-image'

// Printable AR cards: an A4 sheet with four A6 cards and two cut lines, so an
// artist can print it at home and hand the cards out. Two formats:
// - 'obra': the printed obra is what the camera recognizes.
// - 'tarjeta': the Mundial logo is; the obra appears floating over it.

export type CardFormat = 'obra' | 'tarjeta'

const brandTarget = readFileSync(join(process.cwd(), 'public', BRAND_TARGET_PATH))
const brandTargetSrc = `data:image/png;base64,${brandTarget.toString('base64')}`
// tarjeta-marca.png is 746x333.
const BRAND_RATIO = 333 / 746

// A6 at 300 dpi.
const CARD = { width: 1240, height: 1748 }
const MM = CARD.width / 105
// Home printers can't reach the paper's edge; nothing important goes closer.
const SAFE = Math.round(8 * MM)
const INNER = CARD.width - SAFE * 2

type CardInput = {
  format: CardFormat
  imageUrl: string
  title: string
  artist: string
  arUrl: string
}

function titleSize(title: string) {
  if (title.length > 60) return 44
  if (title.length > 32) return 56
  return 72
}

async function renderCard({ format, imageUrl, title, artist, arUrl }: CardInput): Promise<Buffer> {
  const qr = await QRCode.toDataURL(arUrl, {
    margin: 0,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: INK, light: '#FFFFFF' },
  })
  const steps =
    format === 'obra'
      ? ['Escaneá el código', 'Apuntá la cámara a la obra', 'Tocá la pantalla']
      : ['Escaneá el código', 'Apuntá la cámara al logo', 'Tocá la pantalla']

  // The obra gets whatever height the rest of the card leaves.
  const artwork = format === 'obra' ? await loadArtwork(imageUrl, { width: INNER, height: 940 }) : null

  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          color: INK,
          padding: SAFE,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} width={340} height={Math.round(340 * BANNER_RATIO)} alt="" />
          <div
            style={{
              display: 'flex',
              background: RED,
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
              padding: '10px 18px',
            }}
          >
            REALIDAD AUMENTADA
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {format === 'obra' && artwork && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork.src} width={artwork.width} height={artwork.height} alt="" />
          )}
          {format === 'tarjeta' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: INNER }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  width: INNER,
                  fontFamily: 'Anton',
                  fontSize: 76,
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}
              >
                HAY UNA OBRA ESCONDIDA EN ESTA TARJETA
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandTargetSrc} width={INNER} height={Math.round(INNER * BRAND_RATIO)} alt="" style={{ marginTop: 56 }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28 }}>
          <div style={{ display: 'flex', fontFamily: 'Anton', fontSize: titleSize(title), lineHeight: 1.05 }}>
            {title.toUpperCase()}
          </div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 34, fontWeight: 700 }}>{artist}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={300} height={300} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 44, flex: 1 }}>
            {steps.map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', marginBottom: 14, fontSize: 34, fontWeight: 700 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    background: BLUE,
                    color: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 18,
                    fontSize: 28,
                  }}
                >
                  {i + 1}
                </div>
                {step}
              </div>
            ))}
            <div style={{ display: 'flex', marginTop: 6, fontSize: 26, opacity: 0.6 }}>{DOMAIN}</div>
          </div>
        </div>
      </div>
    ),
    { ...CARD, fonts },
  )

  // JPEG keeps the PDF light; the page embeds it once for all four cards.
  return sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 90 }).toBuffer()
}

// In PDF points (1/72 in).
const PT = 72 / 25.4
const A4 = { width: 210 * PT, height: 297 * PT }
const A6 = { width: 105 * PT, height: 148 * PT }

export async function printCardsPdf(input: CardInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${input.title} — ${input.artist} | Mundial de Collage`)
  pdf.setCreator('Mundial de Collage')

  const card = await pdf.embedJpg(await renderCard(input))
  const page = pdf.addPage([A4.width, A4.height])
  // Two A6 fill the A4's width exactly and leave 1 mm of its height over.
  const top = (A4.height - A6.height * 2) / 2
  for (const col of [0, 1]) {
    for (const row of [0, 1]) {
      page.drawImage(card, { x: col * A6.width, y: top + row * A6.height, ...A6 })
    }
  }

  // One vertical and one horizontal cut turn the sheet into four cards.
  const cut = { thickness: 0.6, color: rgb(0.6, 0.6, 0.6), dashArray: [4, 3] }
  page.drawLine({ start: { x: A4.width / 2, y: 0 }, end: { x: A4.width / 2, y: A4.height }, ...cut })
  page.drawLine({ start: { x: 0, y: A4.height / 2 }, end: { x: A4.width, y: A4.height / 2 }, ...cut })

  return pdf.save()
}
