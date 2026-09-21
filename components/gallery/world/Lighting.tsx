export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      {/* One soft fill point light per room so the far ends don't go flat and
          dark — stands in for gallery track lighting until real fixtures
          are art-directed in the Etapa 6 pass. */}
      <pointLight position={[-12, 3.2, 0]} intensity={12} distance={12} decay={2} />
      <pointLight position={[0, 3.2, 0]} intensity={12} distance={12} decay={2} />
      <pointLight position={[12, 3.2, 0]} intensity={12} distance={12} decay={2} />
    </>
  )
}
