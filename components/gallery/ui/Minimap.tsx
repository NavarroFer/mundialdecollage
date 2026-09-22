'use client'

import { usePlayerTrackerStore } from '../minimap/store'
import { GALLERY_BOUNDS, walls } from '../world/roomsData'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

const PADDING = 1.5
const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
const viewBox = `${minX - PADDING} ${minZ - PADDING} ${maxX - minX + PADDING * 2} ${maxZ - minZ + PADDING * 2}`

const PLAYER_DOT_RADIUS = 0.55
const HEADING_LENGTH = 1.4

const mapColors: Record<GalleryTheme, { floor: string; wall: string; player: string; stroke: string }> = {
  museum: { floor: '#3a352f', wall: '#faf8f2', player: '#e79d00', stroke: '#1b110c' },
  windows98: { floor: '#008080', wall: '#c0c0c0', player: '#ffff00', stroke: '#000080' },
  ps2: { floor: '#02020d', wall: '#263b9e', player: '#a9baff', stroke: '#496dff' },
}

export function Minimap({ theme }: { theme: GalleryTheme }) {
  const x = usePlayerTrackerStore((state) => state.x)
  const z = usePlayerTrackerStore((state) => state.z)
  const heading = usePlayerTrackerStore((state) => state.heading)

  const tipX = x + Math.sin(heading) * HEADING_LENGTH
  const tipZ = z - Math.cos(heading) * HEADING_LENGTH
  const colors = mapColors[theme]

  return (
    <div className={`${styles.hudPanel} animate-in fade-in absolute top-4 right-4 z-20 w-56 duration-300`}>
      <svg viewBox={viewBox} className="block w-full" style={{ aspectRatio: `${maxX - minX + PADDING * 2} / ${maxZ - minZ + PADDING * 2}` }}>
        <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} fill={colors.floor} />
        {walls.map((wall) => (
          <rect
            key={wall.id}
            x={wall.position[0] - wall.size[0] / 2}
            y={wall.position[2] - wall.size[2] / 2}
            width={wall.size[0]}
            height={wall.size[2]}
            fill={colors.wall}
          />
        ))}
        <line x1={x} y1={z} x2={tipX} y2={tipZ} stroke={colors.player} strokeWidth={0.35} strokeLinecap="round" />
        <circle cx={x} cy={z} r={PLAYER_DOT_RADIUS} fill={colors.player} stroke={colors.stroke} strokeWidth={0.15} />
      </svg>
    </div>
  )
}
