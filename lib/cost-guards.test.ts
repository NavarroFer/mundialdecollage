import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vercel Hobby includes 4 hours of Active CPU per 30 days for the whole team,
// and a project that runs out is paused until the window resets. Drawing an
// image (satori, sharp) costs 0.1–0.5 s of CPU, a page render a few hundred
// times less: in October 2026 link previews redrawn for every crawler hit
// were the biggest single cost. Every file that draws one is listed here
// with how it avoids redrawing; a new one has to be added on purpose.
const IMAGE_RENDERERS: Record<string, string> = {
  'app/api/img/route.ts': 'each size made once, kept in R2 and the CDN',
  'app/opengraph-image.tsx': 'ISR, redrawn at most once a minute',
  'lib/artwork-share-image.tsx': 'drawn once per obra and kept in R2 (lib/share-image-cache.ts)',
  'lib/certificate.tsx': 'on request by the artist (robots.txt keeps crawlers off)',
  'lib/ar/print-cards.tsx': 'on request by the artist',
  'lib/legacy-submissions.ts': 'admin import, run by hand',
  'lib/registro-image-fingerprint.ts': 'admin import, run by hand',
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('CPU cost guards', () => {
  it('draws images on the server only where it avoids redrawing them', () => {
    const renderers = ['app', 'lib', 'components']
      .flatMap(sourceFiles)
      .filter((file) => /new ImageResponse\(|from 'sharp'/.test(readFileSync(file, 'utf8')))
    const unexpected = renderers.filter((file) => !(file in IMAGE_RENDERERS))
    expect(
      unexpected,
      'New server-side image rendering: cache what it draws (lib/share-image-cache.ts, R2, or ISR) so it is drawn once, then list it in IMAGE_RENDERERS with how.',
    ).toEqual([])
  })
})
