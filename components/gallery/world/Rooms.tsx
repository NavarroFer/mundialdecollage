import { useSurfaceDetail } from '../graphics/SurfaceDetail'
import { useEffect, useMemo } from 'react'
import {
  BASEBOARD_HEIGHT,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  WALL_HEIGHT,
  WALL_THICKNESS,
  ceilingAroundSkylights,
  mainGalleryTemplate,
  type Bounds,
  type GalleryRoomTemplate,
  type WallSegment,
} from './roomsData'
import { plankTexture } from './architectureTextures'
import { galleryThemes, type GalleryTheme } from '../themes'

// A modern dark skirting board along every wall's base — reuses the wall's
// own footprint but stands a hair thicker so the trim line doesn't z-fight
// with the paint behind it. A free-standing panel's ends show too, so its
// board wraps around them.
const BASEBOARD_PROTRUSION = 0.04
function baseboardSize({ size, freestanding }: WallSegment): [number, number, number] {
  const [width, , depth] = size
  const grow = (side: number) => (side === WALL_THICKNESS || freestanding ? side + BASEBOARD_PROTRUSION : side)
  return [grow(width), BASEBOARD_HEIGHT, grow(depth)]
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

function WindowsPaintDetails({ template }: { template: GalleryRoomTemplate }) {
  const colors = ['#000080', '#008080', '#ff00ff', '#ffff00', '#00ff00', '#ff0000']
  const bounds = template.bounds
  const [minX, , maxX, maxZ] = bounds
  const width = Math.min(maxX - minX - 1, colors.length * 1.15)
  const start = template.id === 'main' ? -15 : (minX + maxX - width) / 2
  const z = template.id === 'main' ? 4.8 : maxZ - 0.2
  return (
    <group>
      {colors.map((color, index) => (
        <mesh key={color} position={[start + index * (width / colors.length), 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.85, 0.26]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

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

const PATH_WIDTH = 1.85
const STONE_SPACING = 3

/** The sand path's straight runs, each overlapping the next at the corner. */
export function gardenPathRuns(path: Array<[number, number]>): Bounds[] {
  return path.slice(1).map(([x, z], index): Bounds => {
    const [px, pz] = path[index]
    const half = PATH_WIDTH / 2
    return [Math.min(x, px) - half, Math.min(z, pz) - half, Math.max(x, px) + half, Math.max(z, pz) + half]
  })
}

function gardenPathGeometry(path: Array<[number, number]>) {
  const runs = gardenPathRuns(path)
  const stones: [number, number][] = []
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1]
    const [bx, bz] = path[i]
    const length = Math.hypot(bx - ax, bz - az)
    const first = 1 + Math.ceil((walked - 1) / STONE_SPACING) * STONE_SPACING - walked
    for (let along = first; along < length; along += STONE_SPACING) {
      stones.push([ax + ((bx - ax) * along) / length, az + ((bz - az) * along) / length])
    }
    walked += length
  }
  return { runs, stones }
}

function GardenDetails({ template }: { template: GalleryRoomTemplate }) {
  const { runs, stones } = useMemo(() => gardenPathGeometry(template.garden.path), [template])
  return (
    <group>
      {runs.map(([x0, z0, x1, z1], index) => (
        <mesh key={index} position={[(x0 + x1) / 2, 0.014, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
          <meshStandardMaterial color="#e9c989" roughness={1} />
        </mesh>
      ))}
      {stones.map(([x, z], index) => (
        <mesh key={index} position={[x, 0.035, z]} receiveShadow>
          <cylinderGeometry args={[0.48, 0.54, 0.055, 12]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#f5dfae' : '#d8b979'} roughness={1} />
        </mesh>
      ))}
      {template.garden.flowers.map((flower) => (
        <GardenFlower key={`${flower.x}-${flower.z}`} {...flower} />
      ))}
    </group>
  )
}

const PLANK_TILE_METERS = 4

function Ceiling({ color, skylights, template }: { color: string; skylights: boolean; template: GalleryRoomTemplate }) {
  const panels = skylights ? ceilingAroundSkylights(template) : [template.bounds]
  return panels.map(([x0, z0, x1, z1]) => (
    <mesh key={`${x0} ${z0}`} position={[(x0 + x1) / 2, WALL_HEIGHT, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  ))
}

export function Rooms({ theme, template = mainGalleryTemplate }: { theme: GalleryTheme; template?: GalleryRoomTemplate }) {
  const { maps, anisotropy } = useSurfaceDetail()
  const palette = galleryThemes[theme].room
  const architecture = galleryThemes[theme].architecture
  const [minX, minZ, maxX, maxZ] = template.bounds
  const floorWidth = maxX - minX
  const floorDepth = maxZ - minZ
  const floorCenter: [number, number] = [(minX + maxX) / 2, (minZ + maxZ) / 2]
  const planks = useMemo(() => {
    if (!architecture?.planks) return null
    const texture = plankTexture(palette.floor, PLANK_TILE_METERS)
    texture.repeat.set(floorWidth / PLANK_TILE_METERS, floorDepth / PLANK_TILE_METERS)
    return texture
  }, [architecture, floorDepth, floorWidth, palette.floor])
  useEffect(() => () => planks?.dispose(), [planks])
  // Three textures are mutable GPU resources; reuse the map instead of allocating on every quality change.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { if (planks) { planks.anisotropy = anisotropy; planks.needsUpdate = true } }, [planks, anisotropy])
  return (
    <group>
      <mesh position={[floorCenter[0], 0, floorCenter[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color={planks ? '#ffffff' : palette.floor} map={planks} bumpMap={planks ? maps?.wood : null} bumpScale={0.012} roughnessMap={planks ? maps?.wood : null} roughness={theme === 'garden' ? 0.95 : planks ? 0.68 : 0.6} />
      </mesh>

      {theme !== 'garden' && <Ceiling color={palette.ceiling} skylights={Boolean(architecture?.skylight)} template={template} />}

      {template.walls.map((wall) => (
        <mesh key={wall.id} position={wall.position} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={palette.wall} bumpMap={theme === 'windows98' ? null : maps?.plaster} bumpScale={0.006} roughness={theme === 'garden' ? 0.88 : 0.82} />
        </mesh>
      ))}

      {template.walls.map((wall) => (
        <mesh
          key={`${wall.id}-baseboard`}
          position={[wall.position[0], BASEBOARD_HEIGHT / 2, wall.position[2]]}
          receiveShadow
        >
          <boxGeometry args={baseboardSize(wall)} />
          <meshStandardMaterial color={palette.trim} roughness={theme === 'garden' ? 0.9 : 0.5} />
        </mesh>
      ))}

      {template.doorways.map((doorway) => (
        <DoorwayFrame key={doorway.id} center={doorway.center} axis={doorway.axis} theme={theme} />
      ))}
      {theme === 'windows98' && <WindowsPaintDetails template={template} />}
      {theme === 'garden' && <GardenDetails template={template} />}
    </group>
  )
}
