import { describe, expect, it } from 'vitest'
import { galleryArtworkPath, galleryReturnPath, readGalleryReturn, readSharedArtwork } from './gallery-return'

describe('gallery return link', () => {
  it('round-trips the obra and the pending action', () => {
    const path = galleryReturnPath({ slug: 'luz & sombra', intent: 'comment' })
    expect(path.startsWith('/galeria-3d?')).toBe(true)
    expect(readGalleryReturn(path.slice(path.indexOf('?')))).toEqual({ slug: 'luz & sombra', intent: 'comment' })
  })

  it('reads a shared obra link, but not a sign-in return', () => {
    expect(readSharedArtwork(galleryArtworkPath('luz & sombra').split('?')[1])).toBe('luz & sombra')
    expect(readSharedArtwork('?obra=x&accion=like')).toBeNull()
    expect(readSharedArtwork('')).toBeNull()
  })

  it('ignores links without a known action', () => {
    expect(readGalleryReturn('?obra=x')).toBeNull()
    expect(readGalleryReturn('?obra=x&accion=borrar')).toBeNull()
    expect(readGalleryReturn('')).toBeNull()
  })
})
