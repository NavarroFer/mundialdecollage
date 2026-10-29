import type { GalleryFrameStyle } from '@/data/artworks'
import { galleryThemes, type GalleryTheme } from '../themes'

export type FramePresentation = {
  outer: string
  mat: string
  roughness: number
  metalness: number
  emissive?: string
  matMargin: number
  border: number
  depth: number
}

const STANDARD_MAT_MARGIN = 0.07
const STANDARD_FRAME_BORDER = 0.045
const STANDARD_FRAME_DEPTH = 0.035

export function framePresentation(style: GalleryFrameStyle, theme: GalleryTheme): FramePresentation {
  const themed = galleryThemes[theme].frame
  switch (style) {
    case 'wood':
      return { outer: '#6f4d32', mat: '#f2eadc', roughness: 0.82, metalness: 0, matMargin: 0.065, border: 0.06, depth: 0.045 }
    case 'gold':
      return { outer: '#b08a3e', mat: '#f7f0df', roughness: 0.28, metalness: 0.68, matMargin: 0.075, border: 0.07, depth: 0.05 }
    case 'black-mat':
      return { outer: '#211f1c', mat: '#111111', roughness: 0.72, metalness: 0, matMargin: 0.11, border: 0.04, depth: 0.035 }
    case 'pinned':
      return { outer: 'transparent', mat: 'transparent', roughness: 1, metalness: 0, matMargin: 0, border: 0, depth: 0.012 }
    case 'standard':
      return {
        outer: themed.outer,
        mat: themed.mat,
        roughness: themed.roughness,
        metalness: 0,
        emissive: themed.emissive,
        matMargin: STANDARD_MAT_MARGIN,
        border: STANDARD_FRAME_BORDER,
        depth: STANDARD_FRAME_DEPTH,
      }
  }
}
