// Builds the 3D gallery's people: every cast member in
// components/gallery/world/people/cast.ts, from Microsoft Rocketbox (MIT), as
// compressed glTF, plus the shared walk and idle for each sex and a
// portrait of everyone for the avatar picker.
//
//   node scripts/avatars/build.mjs [out]      (default: a folder in the system's temp)
//
// Then upload <out>/avatars/ to the root of the gallery's public R2 bucket
// (NEXT_PUBLIC_GALLERY_ASSETS_URL). When the files change, bump
// AVATARS_VERSION in cast.ts first: browsers keep each URL for good.
//
// Needs Google Chrome installed: three.js converts the FBX files inside it.
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

const root = join(import.meta.dirname, '../..')
const out = process.argv[2] ?? join(tmpdir(), 'mundial-avatars')
const raw = await mkdtemp(join(tmpdir(), 'avatars-'))

const bundle = await build({
  entryPoints: [join(import.meta.dirname, 'page.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  // cast.ts reads it to build URLs; the conversion doesn't need them.
  define: { 'process.env.NEXT_PUBLIC_GALLERY_ASSETS_URL': '""' },
  logLevel: 'warning',
})
const html = `<!doctype html><meta charset="utf-8"><script>${bundle.outputFiles[0].text}</script>`

// The page posts each converted file back here.
const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') return response.writeHead(200, { 'content-type': 'text/html' }).end(html)
  if (request.method === 'POST' && request.url?.startsWith('/out/')) {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    await writeFile(join(raw, request.url.slice(5).replace(/[^\w.-]/g, '')), Buffer.concat(chunks))
    return response.writeHead(200).end()
  }
  response.writeHead(404).end()
})
await new Promise((resolve) => server.listen(0, resolve))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  page.on('console', (message) => { if (message.text().startsWith('converted')) console.log(message.text()) })
  await page.goto(`http://localhost:${server.address().port}/`)
  await page.waitForFunction(() => window.report, null, { timeout: 30 * 60_000 })
  const report = await page.evaluate(() => window.report)
  if (report.error) throw new Error(report.error)
  console.log('walk speeds (m/s), for NATURAL_WALK in avatarMotion.ts:', report.walkSpeed)

  // 512 px WebP textures and meshopt geometry. No flattening: it would drop
  // the root bone (Bip01) the shared animations drive.
  const target = join(out, 'avatars', report.version)
  await mkdir(target, { recursive: true })
  const gltfTransform = join(root, 'node_modules/.bin/gltf-transform')
  for (const file of (await readdir(raw)).sort()) {
    execFileSync(gltfTransform, ['optimize', join(raw, file), join(target, file), '--texture-compress', 'webp', '--texture-size', '512', '--compress', 'meshopt', '--flatten', 'false'], { stdio: 'ignore' })
  }

  // Portraits: head and shoulders out of Rocketbox's T-pose preview (the figure's top 40%, centered), 150×190.
  await mkdir(join(target, 'thumbs'), { recursive: true })
  for (const [name, url] of Object.entries(report.thumbnails)) {
    const png = Buffer.from(await (await fetch(url)).arrayBuffer())
    const { data, info } = await sharp(png).ensureAlpha().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
    const height = Math.round(info.height * 0.4)
    const width = Math.round(height * 150 / 190)
    await sharp(data).extract({ left: Math.round((info.width - width) / 2), top: 0, width, height })
      .resize(150, 190).webp({ quality: 82, effort: 6 }).toFile(join(target, 'thumbs', `${name}.webp`))
  }
  console.log(`wrote ${target}`)
} finally {
  await browser.close()
  server.close()
  await rm(raw, { recursive: true, force: true })
}
