'use client'

import { useGalleryPreferences } from '../preferences/store'
import { useI18n } from '@/lib/i18n/client'
import type { Artwork } from '@/data/artworks'
import { usePlayerTrackerStore } from '../minimap/store'
import { useEffect, useState } from 'react'
import { MAX_LIVE_VISITORS } from '../presence/protocol'
import { peerPoses, usePresenceStore } from '../presence/store'
import { mainGalleryTemplate, type GalleryRoomTemplate } from '../world/roomsData'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

const PADDING = 1.5
const PLAYER_DOT_RADIUS = 0.55
const HEADING_LENGTH = 1.4

const VIEWED_RADIUS = 0.75
const PEER_DOT_RADIUS = 0.42
// Other visitors' dots come from a non-React map; redraw this often.
const PEER_REFRESH_MS = 250

const noPeers: string[] = []

const mapColors: Record<GalleryTheme, { floor: string; wall: string; player: string; stroke: string; live: string }> = {
  collage: { floor: '#9d7958', wall: '#f2e8d5', player: '#e4b84a', stroke: '#33271f', live: '#3ecf6e' },
  windows98: { floor: '#008080', wall: '#c0c0c0', player: '#ffff00', stroke: '#000080', live: '#00ff00' },
  garden: { floor: '#72ad53', wall: '#fff0c7', player: '#ffcf45', stroke: '#205d3a', live: '#ffffff' },
  atelier: { floor: '#74513a', wall: '#d8cbb8', player: '#e4b84a', stroke: '#3e2b20', live: '#75d59a' },
  industrial: { floor: '#55575a', wall: '#806457', player: '#f2c14e', stroke: '#202326', live: '#77d6ff' },
  museum: { floor: '#6c432e', wall: '#314c3c', player: '#d7b86e', stroke: '#1c2b23', live: '#f5efe2' },
  alley: { floor: '#303238', wall: '#55545a', player: '#e4573f', stroke: '#151720', live: '#79d7ff' },
}

export function Minimap({ theme, artworks, template = mainGalleryTemplate }: { theme: GalleryTheme; artworks: Artwork[]; template?: GalleryRoomTemplate }) {
  const visited = useGalleryPreferences((state) => state.visited)
  const t = useI18n().m.gallery.preferences
  const x = usePlayerTrackerStore((state) => state.x)
  const z = usePlayerTrackerStore((state) => state.z)
  const heading = usePlayerTrackerStore((state) => state.heading)
  const viewers = usePresenceStore((state) => state.viewers)
  const peers = usePresenceStore((state) => ((state.count ?? 0) > MAX_LIVE_VISITORS ? noPeers : state.peers))
  const [, setRefresh] = useState(0)
  const [minX, minZ, maxX, maxZ] = template.bounds
  const viewBox = `${minX - PADDING} ${minZ - PADDING} ${maxX - minX + PADDING * 2} ${maxZ - minZ + PADDING * 2}`

  useEffect(() => {
    if (peers.length === 0) return
    const id = setInterval(() => setRefresh((value) => value + 1), PEER_REFRESH_MS)
    return () => clearInterval(id)
  }, [peers.length])

  const tipX = x + Math.sin(heading) * HEADING_LENGTH
  const tipZ = z - Math.cos(heading) * HEADING_LENGTH
  const colors = mapColors[theme]

  return (
    <div className={`${styles.hudPanel} animate-in fade-in absolute top-4 right-4 z-20 w-56 duration-300`}>
      <p className="px-2 py-1 text-xs">✓ {t.visited}: {artworks.filter((artwork) => visited.includes(artwork.id)).length}/{artworks.length}</p>
      <svg role="img" aria-label={t.visited} viewBox={viewBox} className="block w-full" style={{ aspectRatio: `${maxX - minX + PADDING * 2} / ${maxZ - minZ + PADDING * 2}` }}>
        <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} fill={colors.floor} />
        {template.walls.map((wall) => (
          <rect
            key={wall.id}
            x={wall.position[0] - wall.size[0] / 2}
            y={wall.position[2] - wall.size[2] / 2}
            width={wall.size[0]}
            height={wall.size[2]}
            fill={colors.wall}
          />
        ))}
        {artworks.filter((artwork) => visited.includes(artwork.id)).map((artwork) => <text key={`visited-${artwork.id}`} x={artwork.position[0]} y={artwork.position[2]} fill={colors.player} stroke={colors.stroke} strokeWidth={0.06} fontSize={1.5} textAnchor="middle">✓<title>{artwork.title}</title></text>)}
        {/* Obras someone else has open right now. */}
        {artworks.filter((artwork) => viewers[artwork.id]).map((artwork) => (
          <circle
            key={artwork.id}
            cx={artwork.position[0]}
            cy={artwork.position[2]}
            r={VIEWED_RADIUS}
            fill="none"
            stroke={colors.live}
            strokeWidth={0.3}
            className={styles.viewedMarker}
          />
        ))}
        {peers.map((key) => {
          const pose = peerPoses.get(key)
          return pose ? (
            <circle key={key} cx={pose.x} cy={pose.z} r={PEER_DOT_RADIUS} fill={colors.wall} stroke={colors.stroke} strokeWidth={0.15} />
          ) : null
        })}
        <line x1={x} y1={z} x2={tipX} y2={tipZ} stroke={colors.player} strokeWidth={0.35} strokeLinecap="round" />
        <circle cx={x} cy={z} r={PLAYER_DOT_RADIUS} fill={colors.player} stroke={colors.stroke} strokeWidth={0.15} />
      </svg>
    </div>
  )
}
