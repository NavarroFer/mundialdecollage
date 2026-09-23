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
        <meshStandardMaterial color={galleryThemes[theme].room.wall} roughness={0.75} />
      </mesh>
      <mesh
        position={axis === 'z' ? [0, DOOR_HEIGHT / 2, -jambOffset] : [-jambOffset, DOOR_HEIGHT / 2, 0]}
      >
        <boxGeometry args={jambSize} />
        <meshStandardMaterial color={galleryThemes[theme].room.wall} roughness={0.75} />
      </mesh>
      <mesh
        position={axis === 'z' ? [0, DOOR_HEIGHT / 2, jambOffset] : [jambOffset, DOOR_HEIGHT / 2, 0]}
      >
        <boxGeometry args={jambSize} />
        <meshStandardMaterial color={galleryThemes[theme].room.wall} roughness={0.75} />
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

const ROOM_CENTERS = [-12, 0, 12]
const ROOM_ACCENTS = ['#d84b38', '#487a65', '#e4b84a']

function RoomAccents({ theme }: { theme: GalleryTheme }) {
  const colors = theme === 'garden'
    ? ['#ef6f61', '#7b61a8', '#f1b62e']
    : theme === 'windows98'
      ? ['#ff00ff', '#00ffff', '#ffff00']
      : ROOM_ACCENTS

  return <group>{ROOM_CENTERS.map((x, index) => (
    <mesh key={x} position={[x, 0.009, -4.76]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.2, 0.12]} />
      <meshBasicMaterial color={colors[index]} />
    </mesh>
  ))}</group>
}

function Benches({ theme }: { theme: GalleryTheme }) {
  const seat = theme === 'garden' ? '#ef6f61' : theme === 'windows98' ? '#c0c0c0' : theme === 'collage' ? '#725039' : '#59483e'
  const legs = theme === 'garden' ? '#275f42' : theme === 'windows98' ? '#000080' : '#2b2927'

  return <group>{ROOM_CENTERS.map((x) => (
    <group key={x} position={[x, 0, 2.25]}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.35, 0.18, 0.62]} />
        <meshStandardMaterial color={seat} roughness={0.72} />
      </mesh>
      {[-0.86, 0.86].map((legX) => (
        <mesh key={legX} position={[legX, 0.26, 0]} castShadow>
          <boxGeometry args={[0.13, 0.52, 0.48]} />
          <meshStandardMaterial color={legs} roughness={0.55} metalness={0.08} />
        </mesh>
      ))}
    </group>
  ))}</group>
}

function CollageDetails() {
  const scraps = [
    { x: -16.1, z: 3.9, w: 1.3, h: 0.72, color: '#d84b38', rotation: -0.25 },
    { x: -7.7, z: -3.9, w: 1.6, h: 0.6, color: '#487a65', rotation: 0.18 },
    { x: 4.2, z: 4.05, w: 1.25, h: 0.7, color: '#e4b84a', rotation: -0.12 },
    { x: 15.6, z: -3.95, w: 1.45, h: 0.58, color: '#3766a0', rotation: 0.28 },
  ]
  return <group>{scraps.map((scrap) => (
    <mesh key={`${scrap.x}-${scrap.z}`} position={[scrap.x, 0.012, scrap.z]} rotation={[-Math.PI / 2, 0, scrap.rotation]}>
      <planeGeometry args={[scrap.w, scrap.h]} />
      <meshStandardMaterial color={scrap.color} roughness={0.95} />
    </mesh>
  ))}</group>
}

const GARDEN_FLOWERS = [
  { x: -16, z: -4.25, color: '#ef6f61' },
  { x: -13.2, z: 4.25, color: '#ffd23f' },
  { x: -9, z: -4.25, color: '#8f67b1' },
  { x: -3.5, z: 4.25, color: '#ef6f61' },
  { x: 2.5, z: -4.25, color: '#ff8f3d' },
  { x: 4.7, z: 4.25, color: '#8f67b1' },
  { x: 8.5, z: -4.25, color: '#ffd23f' },
  { x: 13, z: 4.25, color: '#ef6f61' },
  { x: 16.2, z: -4.25, color: '#ff8f3d' },
]

function GardenFlower({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.23, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.46, 8]} />
        <meshStandardMaterial color="#2f7d4a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.08, 0.2, 0]} rotation={[0, 0, -0.7]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#4f9c54" roughness={0.95} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((petal) => {
        const angle = petal * Math.PI / 3
        return (
          <mesh key={petal} position={[Math.cos(angle) * 0.105, 0.5, Math.sin(angle) * 0.105]} scale={[1.25, 0.55, 1.25]} castShadow>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        )
      })}
      <mesh position={[0, 0.505, 0]} castShadow>
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial color="#6b3f22" roughness={0.9} />
      </mesh>
    </group>
  )
}

function GardenDetails() {
  return (
    <group>
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[35.6, 1.85]} />
        <meshStandardMaterial color="#e9c989" roughness={1} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => (
        <mesh key={index} position={[-16.5 + index * 3, 0.035, 0]} receiveShadow>
          <cylinderGeometry args={[0.48, 0.54, 0.055, 12]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#f5dfae' : '#d8b979'} roughness={1} />
        </mesh>
      ))}
      {GARDEN_FLOWERS.map((flower) => (
        <GardenFlower key={`${flower.x}-${flower.z}`} {...flower} />
      ))}
    </group>
  )
}

export function Rooms({ theme }: { theme: GalleryTheme }) {
  const palette = galleryThemes[theme].room
  return (
    <group>
      <mesh position={[floorCenter[0], 0, floorCenter[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color={palette.floor} roughness={theme === 'garden' ? 0.95 : 0.6} />
      </mesh>

      {theme !== 'garden' && (
        <mesh
          position={[floorCenter[0], WALL_HEIGHT, floorCenter[1]]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[floorWidth, floorDepth]} />
          <meshStandardMaterial color={palette.ceiling} roughness={0.9} />
        </mesh>
      )}

      {walls.map((wall) => (
        <mesh key={wall.id} position={wall.position} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={palette.wall} roughness={theme === 'garden' ? 0.88 : 0.75} />
        </mesh>
      ))}

      {walls.map((wall) => (
        <mesh
          key={`${wall.id}-baseboard`}
          position={[wall.position[0], BASEBOARD_HEIGHT / 2, wall.position[2]]}
          receiveShadow
        >
          <boxGeometry args={baseboardSize(wall)} />
          <meshStandardMaterial color={palette.trim} roughness={theme === 'garden' ? 0.9 : 0.5} />
        </mesh>
      ))}

      {doorways.map((doorway) => (
        <DoorwayFrame key={doorway.id} center={doorway.center} axis={doorway.axis} theme={theme} />
      ))}
      {theme === 'windows98' && <WindowsPaintDetails />}
      <RoomAccents theme={theme} />
      <Benches theme={theme} />
      {theme === 'collage' && <CollageDetails />}
      {theme === 'garden' && <GardenDetails />}
    </group>
  )
}
