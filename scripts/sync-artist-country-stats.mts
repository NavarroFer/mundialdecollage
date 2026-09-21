// Inputs: connector snapshots of Registro and 21/9 as string[][].
// node scripts/sync-artist-country-stats.mts registro.json countries-21-9.json
// Only anonymous aggregates enter the repository; no names or emails.
import { readFileSync, writeFileSync } from 'node:fs'
import { buildArtistCountryStats } from '../lib/artist-country-stats.ts'

if (!process.argv[2] || !process.argv[3]) throw new Error('Faltan los snapshots de Registro y 21/9.')
const stats = buildArtistCountryStats(
  JSON.parse(readFileSync(process.argv[2], 'utf8')),
  JSON.parse(readFileSync(process.argv[3], 'utf8')),
)
const snapshot = {
  sourceUrl: 'https://docs.google.com/spreadsheets/d/1OsmZcP9F4AwIZTJpLq-uzJ__Hv-D0MyoenELXFGqFxM/edit#gid=0',
  sheet: 'Registro',
  countrySource: '21/9',
  ...stats,
}
writeFileSync('data/artist-country-stats.json', JSON.stringify(snapshot, null, 2) + '\n')
console.log(JSON.stringify(stats))
