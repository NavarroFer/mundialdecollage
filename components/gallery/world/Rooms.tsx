import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  GALLERY_BOUNDS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  doorways,
  walls,
} from './roomsData'

const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
const floorWidth = maxX - minX
const floorDepth = maxZ - minZ
const floorCenter: [number, number] = [(minX + maxX) / 2, (minZ + maxZ) / 2]

const wallMaterial = <meshStandardMaterial color="#f4f2ec" roughness={0.9} />

function DoorwayFrame({ center, axis }: { center: [number, number, number]; axis: 'x' | 'z' }) {
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
        {wallMaterial}
      </mesh>
      <mesh
        position={axis === 'z' ? [0, DOOR_HEIGHT / 2, -jambOffset] : [-jambOffset, DOOR_HEIGHT / 2, 0]}
      >
        <boxGeometry args={jambSize} />
        {wallMaterial}
      </mesh>
      <mesh
        position={axis === 'z' ? [0, DOOR_HEIGHT / 2, jambOffset] : [jambOffset, DOOR_HEIGHT / 2, 0]}
      >
        <boxGeometry args={jambSize} />
        {wallMaterial}
      </mesh>
    </group>
  )
}

export function Rooms() {
  return (
    <group>
      <mesh position={[floorCenter[0], 0, floorCenter[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color="#d8d3c7" roughness={0.75} />
      </mesh>

      <mesh
        position={[floorCenter[0], WALL_HEIGHT, floorCenter[1]]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color="#fbfaf7" roughness={1} />
      </mesh>

      {walls.map((wall) => (
        <mesh key={wall.id} position={wall.position} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          {wallMaterial}
        </mesh>
      ))}

      {doorways.map((doorway) => (
        <DoorwayFrame key={doorway.id} center={doorway.center} axis={doorway.axis} />
      ))}
    </group>
  )
}
