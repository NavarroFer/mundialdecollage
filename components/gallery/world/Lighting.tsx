const WARM_WHITE = '#fff3df'

import type { GalleryTheme } from '../themes'

export function Lighting({ theme }: { theme: GalleryTheme }) {
  if (theme === 'windows98') {
    return <><ambientLight intensity={1.05} color="#ffffff" /><directionalLight position={[0, 8, 2]} intensity={1.4} color="#ffffff" castShadow /></>
  }

  if (theme === 'ps2') {
    return <><ambientLight intensity={0.22} color="#3446aa" /><directionalLight position={[4, 8, 2]} intensity={1.5} color="#7290ff" castShadow /><pointLight position={[-12, 2.4, 0]} intensity={20} distance={11} decay={2} color="#334dff" /><pointLight position={[0, 2.4, 0]} intensity={18} distance={11} decay={2} color="#755cff" /><pointLight position={[12, 2.4, 0]} intensity={20} distance={11} decay={2} color="#334dff" /></>
  }

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1}
        color={WARM_WHITE}
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
      {/* One soft fill point light per room, warm like gallery track
          lighting, so the far ends don't go flat and dark. */}
      <pointLight position={[-12, 3.2, 0]} intensity={11} distance={12} decay={2} color={WARM_WHITE} />
      <pointLight position={[0, 3.2, 0]} intensity={11} distance={12} decay={2} color={WARM_WHITE} />
      <pointLight position={[12, 3.2, 0]} intensity={11} distance={12} decay={2} color={WARM_WHITE} />
    </>
  )
}
