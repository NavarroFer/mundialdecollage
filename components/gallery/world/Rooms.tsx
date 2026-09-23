import { useTexture } from '@react-three/drei'
import { SRGBColorSpace, type Texture } from 'three'
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

function svgTexture(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const PAINT_WINDOW_TEXTURE = svgTexture(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="720" viewBox="0 0 1000 720">
  <rect width="1000" height="720" fill="#c0c0c0"/>
  <path d="M2 718V2h996" fill="none" stroke="#fff" stroke-width="5"/>
  <path d="M998 2v716H2" fill="none" stroke="#202020" stroke-width="5"/>
  <rect x="10" y="10" width="980" height="52" fill="#000080"/>
  <text x="66" y="45" fill="#fff" font-family="Arial,sans-serif" font-size="27" font-weight="700">sin título - Paint</text>
  <g transform="translate(22 20)"><rect width="30" height="30" fill="#fff"/><path d="M4 25 11 8l5 10 5-6 6 13Z" fill="#00a000"/><circle cx="23" cy="8" r="4" fill="#ff0"/></g>
  <g fill="#c0c0c0" stroke="#fff" stroke-width="2"><rect x="866" y="18" width="34" height="34"/><rect x="905" y="18" width="34" height="34"/><rect x="944" y="18" width="34" height="34"/></g>
  <g stroke="#111" stroke-width="4"><path d="M873 43h20"/><rect x="912" y="26" width="18" height="15" fill="none"/><path d="m952 26 18 18m0-18-18 18"/></g>
  <rect x="10" y="67" width="980" height="38" fill="#d4d0c8"/>
  <g fill="#111" font-family="Arial,sans-serif" font-size="21"><text x="24" y="94"><tspan text-decoration="underline">A</tspan>rchivo</text><text x="125" y="94"><tspan text-decoration="underline">E</tspan>dición</text><text x="225" y="94"><tspan text-decoration="underline">V</tspan>er</text><text x="287" y="94"><tspan text-decoration="underline">I</tspan>magen</text><text x="385" y="94"><tspan text-decoration="underline">C</tspan>olores</text><text x="483" y="94"><tspan text-decoration="underline">A</tspan>yuda</text></g>
  <rect x="18" y="116" width="112" height="502" fill="#bdbdbd" stroke="#fff" stroke-width="3"/>
  <g fill="#eee" stroke="#303030" stroke-width="3">
    <rect x="29" y="130" width="38" height="38"/><rect x="76" y="130" width="38" height="38"/><rect x="29" y="178" width="38" height="38"/><rect x="76" y="178" width="38" height="38"/>
    <rect x="29" y="226" width="38" height="38"/><rect x="76" y="226" width="38" height="38"/><rect x="29" y="274" width="38" height="38"/><rect x="76" y="274" width="38" height="38"/>
  </g>
  <g stroke="#111" stroke-width="4" fill="none"><path d="m35 160 25-25m-18 0 18 18"/><circle cx="95" cy="149" r="12"/><path d="M38 206h20m-10-20v20"/><path d="m82 185 25 24m-25 0 25-24"/><rect x="38" y="235" width="20" height="20"/><path d="M84 254h22l-11-20Z"/><path d="M36 301q15-30 27 0"/><text x="84" y="304" fill="#111" font-family="serif" font-size="31">A</text></g>
  <rect x="145" y="116" width="833" height="502" fill="#808080"/>
  <rect x="158" y="129" width="807" height="476" fill="#fff"/>
  <g opacity=".97"><path d="M207 210 406 157l112 88-136 94-187-42Z" fill="#ef6f61"/><path d="m575 160 260 55-51 154-247-46Z" fill="#ffd23f"/><circle cx="320" cy="460" r="115" fill="#487a65"/><path d="m475 391 344-27 96 174-384 35Z" fill="#3d67aa"/><path d="M210 550 732 176" stroke="#111" stroke-width="26"/></g>
  <g fill="#fff" stroke="#111" stroke-width="3" font-family="Arial,sans-serif" font-weight="900" text-anchor="middle"><text x="596" y="446" font-size="66">MUNDIAL</text><text x="596" y="509" font-size="48">DE COLLAGE</text></g>
  <rect x="18" y="630" width="960" height="72" fill="#c0c0c0"/>
  <g stroke="#303030" stroke-width="2"><rect x="30" y="642" width="48" height="48" fill="#000"/><rect x="83" y="642" width="48" height="48" fill="#fff"/><rect x="151" y="642" width="48" height="48" fill="#808080"/><rect x="204" y="642" width="48" height="48" fill="#f00"/><rect x="257" y="642" width="48" height="48" fill="#ff0"/><rect x="310" y="642" width="48" height="48" fill="#0f0"/><rect x="363" y="642" width="48" height="48" fill="#0ff"/><rect x="416" y="642" width="48" height="48" fill="#00f"/><rect x="469" y="642" width="48" height="48" fill="#f0f"/><rect x="522" y="642" width="48" height="48" fill="#800080"/></g>
</svg>`)

const EXPLORER_WINDOW_TEXTURE = svgTexture(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650">
  <rect width="900" height="650" fill="#c0c0c0"/>
  <path d="M2 648V2h896" fill="none" stroke="#fff" stroke-width="5"/><path d="M898 2v646H2" fill="none" stroke="#202020" stroke-width="5"/>
  <rect x="10" y="10" width="880" height="54" fill="#000080"/><text x="62" y="47" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="700">Mi PC</text>
  <g transform="translate(22 20)"><rect width="29" height="27" fill="#b8d8ff" stroke="#fff"/><rect x="5" y="5" width="19" height="13" fill="#000080"/><rect x="9" y="21" width="12" height="4" fill="#777"/></g>
  <g fill="#c0c0c0" stroke="#fff" stroke-width="2"><rect x="806" y="19" width="33" height="33"/><rect x="844" y="19" width="33" height="33"/></g><g stroke="#111" stroke-width="4"><rect x="813" y="27" width="18" height="14" fill="none"/><path d="m851 27 18 18m0-18-18 18"/></g>
  <g fill="#111" font-family="Arial,sans-serif" font-size="21"><text x="22" y="95">Archivo</text><text x="112" y="95">Edición</text><text x="205" y="95">Ver</text><text x="260" y="95">Ayuda</text></g>
  <rect x="16" y="112" width="868" height="50" fill="#d4d0c8" stroke="#fff"/><text x="30" y="145" font-family="Arial,sans-serif" font-size="19">Dirección:</text><rect x="126" y="120" width="744" height="34" fill="#fff" stroke="#777"/><text x="143" y="144" font-family="Arial,sans-serif" font-size="18">C:\\MUNDIAL\\OBRAS</text>
  <rect x="17" y="174" width="866" height="428" fill="#fff" stroke="#777" stroke-width="3"/>
  <g font-family="Arial,sans-serif" font-size="18" text-anchor="middle" fill="#111">
    <g transform="translate(105 228)"><path d="M-35 1h31l12 13h47v57h-90Z" fill="#ffd34e" stroke="#9b7b00" stroke-width="3"/><text y="100">Obras elegidas</text></g>
    <g transform="translate(295 228)"><path d="M-35 1h31l12 13h47v57h-90Z" fill="#ffd34e" stroke="#9b7b00" stroke-width="3"/><text y="100">Participantes</text></g>
    <g transform="translate(485 228)"><path d="M-35 1h31l12 13h47v57h-90Z" fill="#ffd34e" stroke="#9b7b00" stroke-width="3"/><text y="100">Collages</text></g>
    <g transform="translate(675 225)"><rect x="-42" width="84" height="73" rx="3" fill="#d8d8d8" stroke="#555" stroke-width="3"/><rect x="-31" y="10" width="62" height="40" fill="#000080"/><rect x="-22" y="58" width="44" height="8" fill="#777"/><text y="103">Galería 3D</text></g>
    <g transform="translate(105 430)"><circle cy="32" r="45" fill="#008080" stroke="#000080" stroke-width="4"/><path d="M-22 32h44M0 10v44" stroke="#fff" stroke-width="6"/><text y="105">Internet</text></g>
    <g transform="translate(295 430)"><rect x="-38" width="76" height="84" fill="#eee" stroke="#555" stroke-width="3"/><path d="M-24 20h48M-24 35h48M-24 50h35" stroke="#000080" stroke-width="5"/><text y="112">README.txt</text></g>
  </g>
  <rect x="17" y="607" width="866" height="30" fill="#c0c0c0" stroke="#fff"/><text x="29" y="629" font-family="Arial,sans-serif" font-size="17">6 objeto(s)</text>
</svg>`)

const DIALOG_WINDOW_TEXTURE = svgTexture(`<svg xmlns="http://www.w3.org/2000/svg" width="820" height="430" viewBox="0 0 820 430">
  <rect width="820" height="430" fill="#c0c0c0"/>
  <path d="M2 428V2h816" fill="none" stroke="#fff" stroke-width="6"/><path d="M818 2v426H2" fill="none" stroke="#202020" stroke-width="6"/>
  <rect x="12" y="12" width="796" height="58" fill="#000080"/><text x="30" y="51" fill="#fff" font-family="Arial,sans-serif" font-size="29" font-weight="700">Mundial de Collage</text>
  <rect x="752" y="22" width="43" height="38" fill="#c0c0c0" stroke="#fff" stroke-width="3"/><path d="m762 31 23 20m0-20-23 20" stroke="#111" stroke-width="5"/>
  <circle cx="112" cy="184" r="54" fill="#0080ff" stroke="#fff" stroke-width="7"/><text x="112" y="211" fill="#fff" font-family="Georgia,serif" font-size="78" font-weight="700" font-style="italic" text-anchor="middle">i</text>
  <text x="196" y="150" fill="#111" font-family="Arial,sans-serif" font-size="29" font-weight="700">¿Querés abrir esta obra?</text>
  <text x="196" y="196" fill="#111" font-family="Arial,sans-serif" font-size="23">Paint encontró un collage increíble.</text>
  <text x="196" y="231" fill="#111" font-family="Arial,sans-serif" font-size="23">Puede cambiar tu manera de mirar.</text>
  <g font-family="Arial,sans-serif" font-size="24" text-anchor="middle"><g><rect x="275" y="313" width="145" height="58" fill="#c0c0c0" stroke="#fff" stroke-width="5"/><path d="M420 313v58H275" fill="none" stroke="#202020" stroke-width="5"/><rect x="284" y="322" width="127" height="40" fill="none" stroke="#111" stroke-dasharray="3 3"/><text x="347" y="351">Sí</text></g><g><rect x="448" y="313" width="180" height="58" fill="#c0c0c0" stroke="#fff" stroke-width="5"/><path d="M628 313v58H448" fill="none" stroke="#202020" stroke-width="5"/><text x="538" y="351">Cancelar</text></g></g>
</svg>`)

function setTextureSrgb(texture: Texture) {
  texture.colorSpace = SRGBColorSpace
}

function RetroWallPanel({
  texture,
  position,
  rotation,
  size,
}: {
  texture: Texture
  position: [number, number, number]
  rotation: [number, number, number]
  size: [number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.025]} castShadow>
        <boxGeometry args={[size[0] + 0.09, size[1] + 0.09, 0.05]} />
        <meshStandardMaterial color="#202020" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0, 0.054]}>
        <planeGeometry args={size} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

function WindowsPaintDetails() {
  const paintTexture = useTexture(PAINT_WINDOW_TEXTURE, setTextureSrgb)
  const explorerTexture = useTexture(EXPLORER_WINDOW_TEXTURE, setTextureSrgb)
  const dialogTexture = useTexture(DIALOG_WINDOW_TEXTURE, setTextureSrgb)
  const colors = ['#000080', '#008080', '#ff00ff', '#ffff00', '#00ff00', '#ff0000']
  return (
    <group>
      <RetroWallPanel
        texture={paintTexture}
        position={[-17.88, 2.55, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[1.7, 1.2]}
      />
      <RetroWallPanel
        texture={dialogTexture}
        position={[-17.88, 1.05, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[1.7, 0.9]}
      />
      <RetroWallPanel
        texture={explorerTexture}
        position={[17.88, 1.8, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        size={[1.7, 1.25]}
      />
      {colors.map((color, index) => (
        <mesh key={color} position={[-15 + index * 1.15, 0.012, 4.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.85, 0.26]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

const ROOM_CENTERS = [-12, 0, 12]

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
      <Benches theme={theme} />
      {theme === 'garden' && <GardenDetails />}
    </group>
  )
}
