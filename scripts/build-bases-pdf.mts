// Arma public/mundial-de-collage.pdf (bases + términos y condiciones +
// manual) desde docs/bases/bases.html y lib/terms.ts. Correr después de
// cambiar cualquiera de los dos:
//   node --import ./scripts/node-project-imports.mjs scripts/build-bases-pdf.mts
// Usa Chrome: el instalado en la máquina, o el que indique CHROME_PATH.
// playwright-core no es dependencia del proyecto (no hace falta en Vercel):
//   npm i --no-save playwright-core
import { readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { site } from '@/lib/site'
import { TERMS_UPDATED_LABEL, TERMS_VERSION, termsIntro, termsSections } from '@/lib/terms'

const root = fileURLToPath(new URL('..', import.meta.url))
const template = await readFile(`${root}docs/bases/bases.html`, 'utf8')

const [day, month] = site.deadlineLabel.split(' de ')
const html = template
  .replaceAll('{{DEADLINE_SHORT}}', `${day} ${month.slice(0, 3).toUpperCase()}`)
  .replaceAll('{{DEADLINE_LABEL}}', site.deadlineLabel)
  .replaceAll('{{PAID_LIMIT}}', String(site.entries.paidLimit))
  .replaceAll('{{FINALISTS}}', String(site.jury.finalists))
  .replaceAll('{{EMAIL}}', site.email)
  .replace(
    '{{TERMS_JSON}}',
    JSON.stringify({ version: TERMS_VERSION, updated: TERMS_UPDATED_LABEL, intro: termsIntro, sections: termsSections }).replace(/</g, '\\u003c'),
  )

// Junto al template, para que resuelvan las rutas relativas de fuentes e imágenes.
const built = `${root}docs/bases/.build.html`
await writeFile(built, html)

const browser = process.env.CHROME_PATH
  ? await chromium.launch({ executablePath: process.env.CHROME_PATH })
  : await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
try {
  const page = await browser.newPage()
  await page.goto(`file://${built}`)
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true)
  await page.pdf({ path: `${root}public/mundial-de-collage.pdf`, preferCSSPageSize: true, printBackground: true })
  const pages = await page.locator('.page').count()
  console.log(`public/mundial-de-collage.pdf — ${pages} páginas, términos v${TERMS_VERSION}`)
} finally {
  await browser.close()
  await rm(built, { force: true })
}
