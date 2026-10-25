'use client'
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { boundedDpr, FrameGovernor } from './quality'
import { useGraphics } from './store'

export function GraphicsRuntime({ active, mobile }: { active: boolean; mobile: boolean }) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const current = useGraphics((s) => s.current)
  const selection = useGraphics((s) => s.selection)
  const adaptive = useGraphics((s) => s.adaptive)
  const governor = useRef(new FrameGovernor())
  useEffect(() => {
    const state = useGraphics.getState()
    state.hydrate()
    state.detect({ mobile, cores: navigator.hardwareConcurrency || undefined, memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, maxTextureSize: gl.capabilities.maxTextureSize })
  }, [gl, mobile])
  useEffect(() => {
    useGraphics.setState({ dpr: boundedDpr(current, size.width, size.height, window.devicePixelRatio || 1, mobile) })
  }, [current, size.width, size.height, mobile])
  useEffect(() => {
    governor.current.reset()
  }, [active, selection, adaptive])
  useEffect(() => {
    const reset = () => { governor.current.reset(); useGraphics.setState({ fps: null }) }
    document.addEventListener('visibilitychange', reset)
    return () => document.removeEventListener('visibilitychange', reset)
  }, [])
  useFrame((_, delta) => {
    if (!active || document.hidden) return
    const state = useGraphics.getState()
    const ceiling = state.selection === 'auto' ? (mobile ? 'high' : 'ultra') : state.selection
    const result = governor.current.sample(delta, state.current, ceiling)
    if (result) useGraphics.setState({ fps: result.fps, ...(state.adaptive ? { current: result.next } : {}) })
  })
  return null
}
