export type StatsArtwork = {
  technique: string | null
  profiles: { is_public: boolean | null }
}

export function buildArtworkStats(artworks: StatsArtwork[]) {
  const counts = new Map<string, number>([
    ['Analógica', 0], ['Digital', 0], ['Mixta', 0], ['Sin técnica registrada', 0],
  ])
  let published = 0
  for (const artwork of artworks) {
    const technique = artwork.technique?.trim() || 'Sin técnica registrada'
    counts.set(technique, (counts.get(technique) ?? 0) + 1)
    if (artwork.profiles.is_public) published++
  }
  return {
    total: artworks.length,
    published,
    pending: artworks.length - published,
    withTechnique: artworks.length - (counts.get('Sin técnica registrada') ?? 0),
    techniques: [...counts].map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es')),
  }
}

export function formatShare(value: number, total: number) {
  return new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 })
    .format(total > 0 ? value / total : 0)
}
