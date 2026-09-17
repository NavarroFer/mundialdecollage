import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3b5695',
          borderRadius: 14,
          transform: 'rotate(-6deg)',
        }}
      >
        <div
          style={{
            transform: 'rotate(6deg)',
            color: '#fdf7ec',
            fontSize: 36,
            fontWeight: 900,
            fontFamily: 'sans-serif',
          }}
        >
          M
        </div>
      </div>
    ),
    size,
  )
}
