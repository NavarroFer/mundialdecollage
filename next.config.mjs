import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DEVICE_SIZES, IMAGE_QUALITY, IMAGE_SIZES } from './lib/image-widths.mjs'

// What the obra share images are drawn from (lib/artwork-share-image.tsx):
// part of their R2 cache key (lib/share-image-cache.ts), so editing the
// template, the banner or a font draws them anew instead of serving old ones.
const shareImageTemplate = createHash('sha256')
for (const file of ['lib/artwork-share-image.tsx', 'public/banner-mundial.png', 'assets/Anton-Regular.ttf', 'assets/Oswald-Cyrillic-700.woff']) {
  shareImageTemplate.update(readFileSync(new URL(file, import.meta.url)))
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { SHARE_IMAGE_TEMPLATE: shareImageTemplate.digest('hex').slice(0, 16) },
  // Dev only: lets a phone open `next dev` through a Cloudflare quick tunnel
  // (https is required for the camera on /ar/[slug]).
  allowedDevOrigins: ['*.trycloudflare.com'],
  // The old participants directory; the home's search replaced it.
  async redirects() {
    return [{ source: '/participantes', destination: '/#participantes', permanent: true }]
  },
  images: {
    // Not Vercel's optimization endpoint, which returns 402 once its image
    // allowance runs out: Storage photos are resized by app/api/img instead.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    deviceSizes: DEVICE_SIZES,
    imageSizes: IMAGE_SIZES,
    qualities: [IMAGE_QUALITY],
    // Artwork photos live in Supabase Storage (public bucket) — allow any
    // project's storage host rather than hardcoding this one, since preview/
    // local envs can point at a different Supabase project.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
