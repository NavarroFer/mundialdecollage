import { countryCodeToFlag } from '@/lib/participants'

// A country's flag: the real SVG when the server sent one (see
// lib/flag-svg.ts), the emoji otherwise. Decorative — the country is always
// named next to it or in the surrounding label.
export function CountryFlag({ countryCode, svg }: { countryCode: string; svg?: string }) {
  if (!svg) return <span aria-hidden>{countryCodeToFlag(countryCode)}</span>
  return (
    <span
      aria-hidden
      className="inline-block h-[0.8em] w-[1.2em] shrink-0 overflow-hidden rounded-[2px] align-[-0.05em] shadow-[0_0_0_1px_rgb(0_0_0/0.12)] [&>svg]:block [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
