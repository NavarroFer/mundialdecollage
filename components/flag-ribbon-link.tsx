'use client'

import type { ReactNode } from 'react'
import { MAP_COUNTRY_EVENT, mapCountryHash, scrollToMap } from '@/lib/map-country-link'

// A ribbon flag: glides down to the map and opens that country's obras.
// The hash goes in the URL too, so a map that hasn't loaded yet (it's lazy)
// still opens the country once it mounts.
export function FlagRibbonLink({
  countryCode,
  label,
  hidden,
  children,
}: {
  countryCode: string
  label: string
  hidden: boolean
  children: ReactNode
}) {
  const hash = mapCountryHash(countryCode)
  return (
    <a
      href={hash}
      aria-label={label}
      tabIndex={hidden ? -1 : undefined}
      className="flag-ribbon__link"
      onClick={(event) => {
        event.preventDefault()
        window.history.replaceState(null, '', hash)
        window.dispatchEvent(new CustomEvent(MAP_COUNTRY_EVENT, { detail: countryCode }))
        scrollToMap()
      }}
    >
      {children}
    </a>
  )
}
