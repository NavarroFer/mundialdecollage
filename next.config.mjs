/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev only: lets a phone open `next dev` through a Cloudflare quick tunnel
  // (https is required for the camera on /ar/[slug]).
  allowedDevOrigins: ['*.trycloudflare.com'],
  images: {
    // Serve stored images directly: Vercel's optimization endpoint can return
    // 402 when its image allowance is unavailable. Imports are resized on upload.
    unoptimized: true,
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
