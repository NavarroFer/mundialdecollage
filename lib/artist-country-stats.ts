export type ArtistCountryStats = {
  totalArtists: number
  countries: { country: string; count: number }[]
}

// One artist per normalized email, regardless of photo or row count.
// Do not merge different people by their display names.
export function buildArtistCountryStats(rows: string[][]): ArtistCountryStats {
  if (rows[0]?.slice(0, 4).join('|') !== 'Nombre|País|Mail|Link de Drive de la foto') {
    throw new Error('Encabezado inesperado en la hoja 21/9.')
  }
  const artists = new Map<string, string>()
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.every((cell) => !cell.trim())) continue
    const email = row[2]?.trim().toLowerCase() ?? ''
    const country = row[1]?.trim().normalize('NFC') || 'Sin país registrado'
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      throw new Error(`Fila ${index + 2}: correo inválido.`)
    }
    const previous = artists.get(email)
    if (previous && previous !== country) {
      throw new Error(`Fila ${index + 2}: países distintos para el mismo artista.`)
    }
    artists.set(email, country)
  }
  if (!artists.size) throw new Error('La hoja 21/9 está vacía.')
  const counts = new Map<string, number>()
  for (const country of artists.values()) counts.set(country, (counts.get(country) ?? 0) + 1)
  return {
    totalArtists: artists.size,
    countries: [...counts].map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'es')),
  }
}
