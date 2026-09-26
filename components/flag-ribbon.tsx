import type { CSSProperties } from 'react'
import * as flags from 'country-flag-icons/string/3x2'
import { countByCountry } from '@/lib/country-breakdown'
import { countryCodeToName, getFinalists } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { FlagRibbonLink } from '@/components/flag-ribbon-link'
import './flag-ribbon.css'

// Enough flags per loop that the ribbon never shows a gap on a wide screen,
// even while only one or two countries have published obras.
const MIN_FLAGS_PER_LOOP = 14

// Cut-out paper never lands straight: each flag gets its own resting tilt.
const TILTS = [-5, 3, -2, 6, -4, 2, -6, 4]

// The blue torn strip under the hero, now carrying one flag per country with
// published obras (live from the database, like the map). The flags march
// past like a banner and each one flutters with a stop-motion jitter, all in
// CSS; tapping one opens that country on the map. The SVGs are inlined here
// on the server, so the browser never loads the ~1.6MB flag set.
export async function FlagRibbon() {
  const [artworks, { locale, m }] = await Promise.all([getFinalists(), getI18n()])
  const countries = countByCountry(artworks.map((artwork) => artwork.countryCode)).flatMap(({ countryCode }) => {
    const svg = countryCode ? (flags as Record<string, string | undefined>)[countryCode] : undefined
    return countryCode && svg ? [{ countryCode, svg }] : []
  })

  if (!countries.length) {
    return <div aria-hidden className="torn-top h-10 w-full bg-collage-blue sm:h-14" />
  }

  const loop = Array.from(
    { length: Math.ceil(MIN_FLAGS_PER_LOOP / countries.length) * countries.length },
    (_, i) => countries[i % countries.length],
  )

  return (
    <section
      aria-label={m.map.flagsLabel}
      className="flag-ribbon torn-top bg-collage-blue"
      style={{ '--flags': loop.length } as CSSProperties}
    >
      {/* Two identical halves: the track slides exactly one half, then
          starts over where it began, so the loop has no visible seam. Only
          the first flag of each country is announced and focusable; the
          repeats are there just to fill the strip. */}
      <div className="flag-ribbon__track">
        {[0, 1].map((half) => (
          <ul key={half} className="flag-ribbon__group">
            {loop.map(({ countryCode, svg }, i) => {
              const repeat = half > 0 || i >= countries.length
              const name = countryCodeToName(countryCode, locale)
              return (
                <li
                  key={i}
                  aria-hidden={repeat || undefined}
                  className="flag-ribbon__item"
                  style={{ '--i': i, '--tilt': `${TILTS[i % TILTS.length]}deg` } as CSSProperties}
                >
                  <FlagRibbonLink
                    countryCode={countryCode}
                    label={fmt(m.map.viewCountry, { country: name })}
                    hidden={repeat}
                  >
                    <span className="flag-ribbon__flag" title={name}>
                      <span className="flag-ribbon__cloth" dangerouslySetInnerHTML={{ __html: svg }} />
                    </span>
                  </FlagRibbonLink>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
    </section>
  )
}
