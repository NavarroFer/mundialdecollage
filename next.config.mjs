/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
