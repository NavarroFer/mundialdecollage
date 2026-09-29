import Link from 'next/link'
import type { ArtistProfileArtwork } from '@/lib/artist-profiles'

export function ArtistArtworks({
  artworks,
  artistName,
  untitled,
  artworkBy,
  techniques,
}: {
  artworks: ArtistProfileArtwork[]
  artistName: string
  untitled: string
  artworkBy: (title: string, name: string) => string
  techniques: Record<string, string>
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2">
      {artworks.map((artwork) => {
        const title = artwork.title ?? untitled
        return (
          <li key={artwork.slug}>
            <Link
              href={`/obras/${artwork.slug}`}
              className="group block overflow-hidden rounded-2xl border-2 border-ink/10 bg-card shadow-sm transition hover:-translate-y-1 hover:border-ink/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-collage-blue/30"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {/* Supabase Storage URLs vary by environment and are not restricted to one Next Image host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={artwork.imageUrl}
                  alt={artworkBy(title, artistName)}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                {artwork.technique && (
                  <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">
                    {techniques[artwork.technique] ?? artwork.technique}
                  </p>
                )}
                <h2 className="font-display mt-1 text-2xl tracking-tight text-ink uppercase">
                  {title}
                </h2>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
