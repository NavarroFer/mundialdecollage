import { describe, expect, it } from 'vitest'
import { cleanInstagramInput, cleanWebsiteInput, imageProblem } from './onboarding-input'
import { MAX_IMAGE_BYTES } from './onboarding-image'

describe('cleanInstagramInput', () => {
  it('leaves an empty field empty', () => {
    expect(cleanInstagramInput('   ')).toBe('')
  })

  it('turns handles and pasted profile links into a bare handle', () => {
    expect(cleanInstagramInput('@ana.collage')).toBe('ana.collage')
    expect(cleanInstagramInput(' ana_collage ')).toBe('ana_collage')
    expect(cleanInstagramInput('https://www.instagram.com/ana.collage/')).toBe('ana.collage')
    expect(cleanInstagramInput('https://www.instagram.com/ana.collage?igsh=MWx0c2F3')).toBe('ana.collage')
    expect(cleanInstagramInput('instagram.com/ana.collage')).toBe('ana.collage')
    expect(cleanInstagramInput('www.instagram.com/ana.collage/?hl=es')).toBe('ana.collage')
  })

  it('refuses what no handle can be', () => {
    expect(cleanInstagramInput('ana collage')).toBeNull()
    expect(cleanInstagramInput('ana-collage')).toBeNull()
    expect(cleanInstagramInput('a'.repeat(31))).toBeNull()
  })
})

describe('cleanWebsiteInput', () => {
  it('leaves an empty field empty', () => {
    expect(cleanWebsiteInput('')).toBe('')
  })

  it('adds the https:// people leave out', () => {
    expect(cleanWebsiteInput('misitio.com')).toBe('https://misitio.com/')
    expect(cleanWebsiteInput('www.misitio.com.ar/obras')).toBe('https://www.misitio.com.ar/obras')
    expect(cleanWebsiteInput('http://misitio.com')).toBe('http://misitio.com/')
  })

  it('refuses other schemes and hosts without a dot', () => {
    expect(cleanWebsiteInput('javascript:alert(1)')).toBeNull()
    expect(cleanWebsiteInput('ftp://misitio.com')).toBeNull()
    expect(cleanWebsiteInput('mi sitio')).toBeNull()
    expect(cleanWebsiteInput('misitio')).toBeNull()
  })
})

describe('imageProblem', () => {
  it('accepts the formats the server stores', () => {
    expect(imageProblem({ type: 'image/jpeg', size: 1024 })).toBeNull()
    expect(imageProblem({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull()
  })

  it('flags phone formats and oversized files', () => {
    expect(imageProblem({ type: 'image/heic', size: 1024 })).toBe('invalid_image')
    expect(imageProblem({ type: '', size: 1024 })).toBe('invalid_image')
    expect(imageProblem({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toBe('image_too_large')
  })
})
