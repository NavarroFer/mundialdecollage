const WARM_WHITE = '#fff3df'

export function Lighting() {
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
