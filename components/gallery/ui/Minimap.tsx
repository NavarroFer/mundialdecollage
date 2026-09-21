'use client'

import { usePlayerTrackerStore } from '../minimap/store'
import { GALLERY_BOUNDS, walls } from '../world/roomsData'

const PADDING = 1.5
const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
const viewBox = `${minX - PADDING} ${minZ - PADDING} ${maxX - minX + PADDING * 2} ${maxZ - minZ + PADDING * 2}`

const PLAYER_DOT_RADIUS = 0.55
const HEADING_LENGTH = 1.4

export function Minimap() {
  const x = usePlayerTrackerStore((state) => state.x)
  const z = usePlayerTrackerStore((state) => state.z)
  const heading = usePlayerTrackerStore((state) => state.heading)

  const tipX = x + Math.sin(heading) * HEADING_LENGTH
  const tipZ = z - Math.cos(heading) * HEADING_LENGTH

  return (
    <div className="absolute top-4 right-4 w-56 overflow-hidden rounded-lg border border-paper/30 bg-ink/70 shadow-lg backdrop-blur-sm">
      <svg viewBox={viewBox} className="block w-full" style={{ aspectRatio: `${maxX - minX + PADDING * 2} / ${maxZ - minZ + PADDING * 2}` }}>
        <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} fill="#3a352f" />
        {walls.map((wall) => (
          <rect
            key={wall.id}
            x={wall.position[0] - wall.size[0] / 2}
            y={wall.position[2] - wall.size[2] / 2}
            width={wall.size[0]}
            height={wall.size[2]}
            fill="#faf8f2"
          />
        ))}
        <line x1={x} y1={z} x2={tipX} y2={tipZ} stroke="#e79d00" strokeWidth={0.35} strokeLinecap="round" />
        <circle cx={x} cy={z} r={PLAYER_DOT_RADIUS} fill="#e79d00" stroke="#1b110c" strokeWidth={0.15} />
      </svg>
    </div>
  )
}
