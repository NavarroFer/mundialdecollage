// Input: connector snapshot of '21/9'!A1:D926 as string[][].
// node scripts/sync-artist-country-stats.mts .local/countries-21-9.json
// Only anonymous aggregates enter the repository; no names or emails.
import { readFileSync, writeFileSync } from 'node:fs'
import { buildArtistCountryStats } from '../lib/artist-country-stats.ts'

if (!process.argv[2]) throw new Error('Falta el snapshot JSON de la hoja 21/9.')
const stats = buildArtistCountryStats(JSON.parse(readFileSync(process.argv[2], 'utf8')))
const snapshot = {
  sourceUrl: 'https://docs.google.com/spreadsheets/d/1OsmZcP9F4AwIZTJpLq-uzJ__Hv-D0MyoenELXFGqFxM/edit#gid=467638671',
  sheet: '21/9',
  ...stats,
}
writeFileSync('data/artist-country-stats.json', JSON.stringify(snapshot, null, 2) + '\n')
console.log(JSON.stringify(stats))
