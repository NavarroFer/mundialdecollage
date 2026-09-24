import { createSign } from 'node:crypto'
import type { RegistroCell } from '@/lib/registro'

// Service-account auth without the googleapis SDK: a signed JWT exchanged
// for a short-lived read-only token. The sheet only needs to be shared
// (Viewer) with GOOGLE_SERVICE_ACCOUNT_EMAIL.
async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !privateKey) throw new Error('Faltan credenciales de la cuenta de servicio de Google.')

  const now = Math.floor(Date.now() / 1000)
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Google rechazó la cuenta de servicio (${response.status}): ${await response.text()}`)
  return (await response.json()).access_token
}

type SheetsCell = {
  formattedValue?: string
  hyperlink?: string
  chipRuns?: { chip?: { richLinkProperties?: { uri?: string } } }[]
}

// Reads A:E of a tab (E is the artwork title) as native grid data, never
// CSV: a Drive smart chip only exposes its file link through chipRuns, which
// an export would drop.
export async function readSheetGrid(spreadsheetId: string, tab: string): Promise<RegistroCell[][]> {
  const token = await getAccessToken()
  const get = async (fields: string, extra = '') => {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=${encodeURIComponent(fields)}${extra}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000), cache: 'no-store' },
    )
    if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}: ${await response.text()}`)
    return response.json()
  }

  const metadata = await get('sheets.properties.title')
  const titles: string[] = metadata.sheets.map((sheet: { properties: { title: string } }) => sheet.properties.title)
  if (!titles.includes(tab)) throw new Error(`No existe la pestaña "${tab}" (hay: ${titles.join(', ')}).`)

  const grid = await get(
    'sheets.data.rowData.values(formattedValue,hyperlink,chipRuns.chip.richLinkProperties.uri)',
    `&includeGridData=true&ranges=${encodeURIComponent(`'${tab}'!A:E`)}`,
  )
  const rowData: { values?: SheetsCell[] }[] = grid.sheets[0]?.data?.[0]?.rowData ?? []
  return rowData.map((row) =>
    Array.from({ length: 5 }, (_, column) => {
      const cell = row.values?.[column] ?? {}
      const chipUrl = cell.chipRuns?.find((run) => run.chip?.richLinkProperties?.uri)?.chip?.richLinkProperties?.uri
      return { text: cell.formattedValue ?? '', url: chipUrl ?? cell.hyperlink ?? '' }
    }),
  )
}
