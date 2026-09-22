import {
  BASEBOARD_HEIGHT,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  GALLERY_BOUNDS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  doorways,
  walls,
  type WallSegment,
} from './roomsData'
import { galleryThemes, type GalleryTheme } from '../themes'

const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
const floorWidth = maxX - minX
const floorDepth = maxZ - minZ
const floorCenter: [number, number] = [(minX + maxX) / 2, (minZ + maxZ) / 2]

// A modern dark skirting board along every wall's base — reuses the wall's
// own footprint but stands a hair thicker so the trim line doesn't z-fight
// with the paint behind it.
const BASEBOARD_PROTRUSION = 0.04
function baseboardSize({ size }: WallSegment): [number, number, number] {
  const [width, , depth] = size
  return [
    width === WALL_THICKNESS ? width + BASEBOARD_PROTRUSION : width,
    BASEBOARD_HEIGHT,
    depth === WALL_THICKNESS ? depth + BASEBOARD_PROTRUSION : depth,
  ]
}

function DoorwayFrame({ center, axis, theme }: { center: [number, number, number]; axis: 'x' | 'z'; theme: GalleryTheme }) {
  const lintelHeight = WALL_HEIGHT - DOOR_HEIGHT
  const lintelY = DOOR_HEIGHT + lintelHeight / 2
  const jambSize: [number, number, number] =
    axis === 'z' ? [WALL_THICKNESS, DOOR_HEIGHT, 0.1] : [0.1, DOOR_HEIGHT, WALL_THICKNESS]
  const lintelSize: [number, number, number] =
    axis === 'z' ? [WALL_THICKNESS, lintelHeight, DOOR_WIDTH] : [DOOR_WIDTH, lintelHeight, WALL_THICKNESS]
  const jambOffset = DOOR_WIDTH / 2

  return (
    <group position={center}>
      <mesh position={[0, lintelY, 0]} castShadow>
        <boxGeometry args={lintelSize} />
        <meshStandardMaterial color={galleryThemes[theme].room.wall} roughness={theme === 'ps2' ? 0.35 : 0.75} />
      </mesh>
      <mesh
        position={axis === 'z' ? [0, DOOR_HEIGHT / 2, -jambOffset] : [-jambOffset, DOOR_HEIGHT / 2, 0]}
      >
        <boxGeometry args={jambSize} />
        <meshStandardMaterial color={galleryThemes[theme].room.wall} roughness={theme === 'ps2' ? 0.35 : 0.75} />
      </mesh>
      <mesh
        position={axis === 'z' ? [0, DOOR_HEIGHT / 2, jambOffset] : [jambOffset, DOOR_HEIGHT / 2, 0]}
      >
        <boxGeometry args={jambSize} />
        <meshStandardMaterial color={galleryThemes[theme].room.wall} roughness={theme === 'ps2' ? 0.35 : 0.75} />
      </mesh>
    </group>
  )
}

function WindowsPaintDetails() {
  const colors = ['#000080', '#008080', '#ff00ff', '#ffff00', '#00ff00', '#ff0000']
  return <group>{colors.map((color, index) => (
    <mesh key={color} position={[-15 + index * 1.15, 0.012, 4.8]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.85, 0.26]} /><meshBasicMaterial color={color} />
    </mesh>
  ))}</group>
}

function Ps2Details() {
  return <group>
    {[-12, 0, 12].map((x) => (
      <mesh key={x} position={[x, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.16, 48]} /><meshBasicMaterial color="#496dff" />
      </mesh>
    ))}
  </group>
}

export function Rooms({ theme }: { theme: GalleryTheme }) {
  const palette = galleryThemes[theme].room
  return (
    <group>
      <mesh position={[floorCenter[0], 0, floorCenter[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color={palette.floor} roughness={theme === 'ps2' ? 0.25 : 0.6} metalness={theme === 'ps2' ? 0.35 : 0} />
      </mesh>

      <mesh
        position={[floorCenter[0], WALL_HEIGHT, floorCenter[1]]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color={palette.ceiling} roughness={theme === 'ps2' ? 0.5 : 0.9} />
      </mesh>

      {walls.map((wall) => (
        <mesh key={wall.id} position={wall.position} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={palette.wall} roughness={theme === 'ps2' ? 0.35 : 0.75} metalness={theme === 'ps2' ? 0.12 : 0} />
        </mesh>
      ))}

      {walls.map((wall) => (
        <mesh
          key={`${wall.id}-baseboard`}
          position={[wall.position[0], BASEBOARD_HEIGHT / 2, wall.position[2]]}
          receiveShadow
        >
          <boxGeometry args={baseboardSize(wall)} />
          <meshStandardMaterial color={palette.trim} roughness={theme === 'ps2' ? 0.25 : 0.5} emissive={theme === 'ps2' ? palette.trim : '#000000'} emissiveIntensity={theme === 'ps2' ? 0.8 : 0} />
        </mesh>
      ))}

      {doorways.map((doorway) => (
        <DoorwayFrame key={doorway.id} center={doorway.center} axis={doorway.axis} theme={theme} />
      ))}
      {theme === 'windows98' && <WindowsPaintDetails />}
      {theme === 'ps2' && <Ps2Details />}
    </group>
  )
}
