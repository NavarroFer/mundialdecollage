'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useSouvenirStore } from './store'

// The canvas keeps no copy of its last frame (no preserveDrawingBuffer, which
// would cost every frame), so a photo renders the scene once more and copies
// it out in the same task, before the browser clears the buffer.
export function SouvenirCapture() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    const { setCapture } = useSouvenirStore.getState()
    setCapture(() => {
      gl.render(scene, camera)
      const source = gl.domElement
      const shot = document.createElement('canvas')
      shot.width = source.width
      shot.height = source.height
      const context = shot.getContext('2d')
      if (!context) return null
      context.drawImage(source, 0, 0)
      return shot
    })
    return () => setCapture(null)
  }, [gl, scene, camera])

  return null
}
