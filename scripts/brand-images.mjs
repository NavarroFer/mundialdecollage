// Writes the WebP copies of the brand images that next/image serves
// (lib/brand-images.mjs). Run after changing a logo in public/:
//   node scripts/brand-images.mjs
import { mkdir, rm } from 'node:fs/promises'
import sharp from 'sharp'
import { BRAND_IMAGES, BRAND_QUALITY, brandFile, brandWidths } from '../lib/brand-images.mjs'

const root = new URL('../public', import.meta.url).pathname
await rm(`${root}/brand`, { recursive: true, force: true })
await mkdir(`${root}/brand`)

for (const [source, { name, width }] of Object.entries(BRAND_IMAGES)) {
  for (const w of brandWidths(width)) {
    const { size } = await sharp(`${root}${source}`).resize({ width: w }).webp({ quality: BRAND_QUALITY, effort: 6 }).toFile(`${root}${brandFile(name, w)}`)
    console.log(`${brandFile(name, w)}  ${(size / 1024).toFixed(1)} KB`)
  }
}
