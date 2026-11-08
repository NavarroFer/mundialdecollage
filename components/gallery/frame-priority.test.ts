import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// R3F reads a positive useFrame priority as "this hook calls gl.render itself"
// and stops drawing the scene on its own. Museo MAR shipped with one and the
// canvas stayed a flat sky colour. A hook that really renders goes here on purpose.
const MANUAL_RENDERERS: string[] = []

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('gallery frame loop', () => {
  it('lets R3F draw every frame: no useFrame takes a positive priority', () => {
    const offenders = sourceFiles('components/gallery').filter((file) => {
      if (MANUAL_RENDERERS.includes(file)) return false
      const text = readFileSync(file, 'utf8')
      // The closing of a useFrame callback followed by a positive number.
      return /useFrame\([\s\S]*?\n\s*\},\s*[1-9]\d*\s*\)/.test(text)
    })
    expect(offenders).toEqual([])
  })
})
