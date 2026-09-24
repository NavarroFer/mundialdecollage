export type ArtistCountryStats = {
  totalArtists: number
  countries: { country: string; count: number }[]
}

// Registro defines who is participating and carries the curated country per
// row. Counting by email keeps multi-work artists to a single entry.
export function buildArtistCountryStats(registro: string[][]): ArtistCountryStats {
  if (registro[0]?.slice(0, 4).join('|') !== 'Nombre|País|Email|Obra (Foto en Drive)') {
    throw new Error('Encabezado inesperado en la hoja Registro.')
  }
  const artists = new Map<string, string>()
  for (const [index, row] of registro.slice(1).entries()) {
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
  if (!artists.size) throw new Error('La hoja Registro está vacía.')
  const counts = new Map<string, number>()
  for (const country of artists.values()) counts.set(country, (counts.get(country) ?? 0) + 1)
  return {
    totalArtists: artists.size,
    countries: [...counts].map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'es')),
  }
}
