import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

/**
 * Etapa 1 only: a free-look camera to verify the shell renders correctly.
 * Etapa 2 replaces this with Player + FirstPersonCamera (pointer-lock WASD).
 */
export function PreviewCamera() {
  return (
    <>
      <PerspectiveCamera makeDefault fov={60} position={[0, 14, 18]} />
      <OrbitControls target={[0, 1.6, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={40} />
    </>
  )
}
