'use client'

import { useEffect, useRef, useState } from 'react'
import { ArtworkLoader } from '@/components/artwork-loader'
import { cn } from '@/lib/utils'

/** Main artwork image: the paper-scrap loader plays until the file arrives, then the artwork fades in. */
export function ArtworkImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)

  // A cached image can finish before hydration, so onLoad never fires for it.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true)
  }, [])

  return (
    <div className={cn('relative', !loaded && 'min-h-[60vh]')}>
      {!loaded && <ArtworkLoader />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          'w-full object-cover transition-[opacity,transform,filter] duration-700 ease-out motion-reduce:transition-none',
          loaded ? 'scale-100 opacity-100 blur-0' : 'scale-[1.02] opacity-0 blur-sm',
        )}
      />
    </div>
  )
}
