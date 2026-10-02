'use client'

import { imageSrc } from '@/lib/image-src'

// next/image's loader (next.config.mjs). Local files ignore the width.
export default function imageLoader({ src, width }: { src: string; width: number }): string {
  return imageSrc(src, width)
}
