import { describe, expect, it } from 'vitest'
import { galleryArtworkPath, galleryReturnPath, galleryWallReturnPath, readGalleryReturn, readSharedArtwork, readWallReturn } from './gallery-return'

describe('gallery return link', () => {
  it('round-trips the obra and the pending action', () => {
    const path = galleryReturnPath({ slug: 'luz & sombra', intent: 'comment' })
    expect(path.startsWith('/galeria-3d?')).toBe(true)
    expect(readGalleryReturn(path.slice(path.indexOf('?')))).toEqual({ slug: 'luz & sombra', intent: 'comment' })
  })

  it('reads a shared obra link, but not a sign-in return', () => {
    expect(readSharedArtwork(galleryArtworkPath('luz & sombra').split('?')[1])).toBe('luz & sombra')
    expect(readSharedArtwork('?obra=x&accion=like')).toBeNull()
    // Shared links also name the inviting artist (lib/referral.ts).
    expect(readSharedArtwork('?obra=x&ref=x')).toBe('x')
    expect(readSharedArtwork('')).toBeNull()
  })

  it('ignores links without a known action', () => {
    expect(readGalleryReturn('?obra=x')).toBeNull()
    expect(readGalleryReturn('?obra=x&accion=borrar')).toBeNull()
    expect(readGalleryReturn('')).toBeNull()
  })
})

describe('wall sign-in return', () => {
  it('round-trips the point on the frame', () => {
    const path = galleryWallReturnPath({ x: 0.12345, y: 0.9 })
    expect(readWallReturn(path.split('?')[1])).toEqual({ x: 0.123, y: 0.9 })
    expect(readWallReturn('muro=2,0.5')).toBeNull()
    expect(readWallReturn('muro=abc')).toBeNull()
  })
})
