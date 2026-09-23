const WARM_WHITE = '#fff3df'

import type { GalleryTheme } from '../themes'

export function Lighting({ theme }: { theme: GalleryTheme }) {
  if (theme === 'windows98') {
    return <><ambientLight intensity={1.05} color="#ffffff" /><directionalLight position={[0, 8, 2]} intensity={1.4} color="#ffffff" castShadow /></>
  }

  if (theme === 'garden') {
    return <><hemisphereLight color="#dff6ff" groundColor="#56833f" intensity={1.35} /><ambientLight intensity={0.55} color="#fff7db" /><directionalLight position={[-8, 12, 5]} intensity={2.2} color="#fff3c4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-radius={5} /></>
  }

  const warmColor = theme === 'collage' ? '#ffd8a3' : WARM_WHITE
  const wallWashIntensity = theme === 'collage' ? 8 : 9

  return (
    <>
      <ambientLight intensity={theme === 'collage' ? 0.58 : 0.45} color={theme === 'collage' ? '#ffe8c9' : '#ffffff'} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1}
        color={warmColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
        shadow-radius={4}
        shadow-blurSamples={16}
      />
      {/* Two wall washes per room keep both rows of artwork bright while the
          center stays calmer. These don't cast shadows, keeping the six-light
          setup inexpensive on mobile GPUs. */}
      {[-12, 0, 12].flatMap((x) => [-3.25, 3.25].map((z) => (
        <pointLight
          key={`${x}-${z}`}
          position={[x, 2.85, z]}
          intensity={wallWashIntensity}
          distance={7.5}
          decay={2}
          color={warmColor}
        />
      )))}
    </>
  )
}
