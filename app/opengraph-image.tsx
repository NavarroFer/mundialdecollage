import { ImageResponse } from 'next/og'
import { site } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
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
          background: '#fdf7ec',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 88,
            height: 88,
            borderRadius: 18,
            background: '#3b5695',
            transform: 'rotate(-6deg)',
            color: '#fdf7ec',
            fontSize: 48,
            fontWeight: 900,
          }}
        >
          M
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 48,
            fontSize: 68,
            fontWeight: 900,
            lineHeight: 1.05,
            color: '#301f14',
            maxWidth: 900,
          }}
        >
          {site.name}
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 32, color: '#8a6d4a' }}>
          {site.tagline} — convocatoria abierta hasta el {site.deadlineLabel}
        </div>
      </div>
    ),
    size,
  )
}
