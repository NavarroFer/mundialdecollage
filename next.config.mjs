import { DEVICE_SIZES, IMAGE_QUALITY, IMAGE_SIZES } from './lib/image-widths.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev only: lets a phone open `next dev` through a Cloudflare quick tunnel
  // (https is required for the camera on /ar/[slug]).
  allowedDevOrigins: ['*.trycloudflare.com'],
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
