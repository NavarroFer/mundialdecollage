/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Onboarding accepts artwork photos up to 8MB (see MAX_IMAGE_BYTES in
      // app/onboarding/actions.ts); Next.js' 1MB default rejects those
      // uploads with a 500 before the action code runs. Leave headroom for
      // multipart/form-data overhead.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
