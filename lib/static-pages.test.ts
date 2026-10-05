import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isStaticPage, STATIC_PAGES } from './static-pages'

const pageFile = (page: string, prefix = '') => `app/[locale]/(site)${prefix}${page === '/' ? '' : page}/page.tsx`

describe('STATIC_PAGES', () => {
  it.each(STATIC_PAGES)('%s has the page and an anonymous copy that can be built ahead', (page) => {
    expect(existsSync(pageFile(page)), pageFile(page)).toBe(true)
    const copy = pageFile(page, '/anon')
    expect(existsSync(copy), copy).toBe(true)
    const source = readFileSync(copy, 'utf8')
    // Without these the copy reads the session (or nothing ever refreshes it).
    expect(source).toMatch(/export default function \w+\([^)]*\)[^{]*\{\s*renderAsAnonymous\(\)/)
    if (/export function generateMetadata/.test(source)) {
      expect(source).toMatch(/export function generateMetadata\([^)]*\)[^{]*\{\s*renderAsAnonymous\(\)/)
    }
    expect(source).toMatch(/export const revalidate = \d+/)
    if (/export (async )?function generateMetadata|export const metadata/.test(readFileSync(pageFile(page), 'utf8'))) {
      expect(source, `${copy} keeps the page's metadata`).toMatch(/generateMetadata|metadata/)
    }
  })

  it('matches the paths it lists, and only those', () => {
    expect(isStaticPage('/')).toBe(true)
    expect(isStaticPage('/obras/una-obra')).toBe(true)
    expect(isStaticPage('/obras/una-obra/')).toBe(true)
    expect(isStaticPage('/obras/una-obra/historia')).toBe(false)
    expect(isStaticPage('/onboarding/obras')).toBe(false)
    expect(isStaticPage('/admin')).toBe(false)
  })
})
