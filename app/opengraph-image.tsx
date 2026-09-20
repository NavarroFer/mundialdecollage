import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { site } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  const logoBase64 = readFileSync(join(process.cwd(), 'public/logo.png')).toString('base64')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#FAF8F2',
        }}
      >
        <img
          src={`data:image/png;base64,${logoBase64}`}
          width={560}
          height={146}
          alt=""
          style={{ objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', marginTop: 40, fontSize: 32, color: '#1B110C' }}>
          {site.tagline} — convocatoria abierta hasta el {site.deadlineLabel}
        </div>
      </div>
    ),
    size,
  )
}
