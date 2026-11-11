// Tags every public obra that has no tags yet, one model call per obra.
// Idempotent: rows that already have tags are skipped unless --force.
//
//   node --env-file=.env.local scripts/tag-artworks.mjs --dry-run
//   node --env-file=.env.local scripts/tag-artworks.mjs --limit=50
//   node --env-file=.env.local scripts/tag-artworks.mjs --concurrency=6
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; a real run
// (no --dry-run) also needs ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { COMMUNITY_TAGS, cleanTags } from '../lib/community-tags.ts'

// Must match MODEL in lib/community-ai.ts — the admin flow tags an obra with
// the same model, so both paths produce comparable labels.
const MODEL = 'claude-haiku-5-5'

const PAGE_SIZE = 500
// Retries after the first attempt (so up to three calls per obra).
const RETRIES = 2

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv) {
  const options = { dryRun: false, force: false, limit: Infinity, concurrency: 3 }
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--force') options.force = true
    else if (arg.startsWith('--limit=')) {
      const limit = Number(arg.slice('--limit='.length))
      if (!Number.isInteger(limit) || limit < 1) fail(`--limit inválido: ${arg}`)
      options.limit = limit
    } else if (arg.startsWith('--concurrency=')) {
      const concurrency = Number(arg.slice('--concurrency='.length))
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
        fail(`--concurrency debe ser un entero entre 1 y 8: ${arg}`)
      }
      options.concurrency = concurrency
    } else fail(`Flag desconocida: ${arg}`)
  }
  return options
}

const options = parseArgs(process.argv.slice(2))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) fail('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local.')
if (!options.dryRun && !process.env.ANTHROPIC_API_KEY) {
  fail('Falta ANTHROPIC_API_KEY. Usá --dry-run para ver qué se etiquetaría sin llamar a la IA.')
}

const db = createClient(url, key, { auth: { persistSession: false } })

// Public obras only: the same rows the feed and «Explorar» can show. Empty
// tags are written as '{}' by the column default, so `eq('tags', '{}')` is
// the "never tagged" set.
const COLUMNS = 'id, slug, title, technique, image_url, tags'

function query(from) {
  let request = db
    .from('artworks')
    .select(COLUMNS)
    .eq('is_selected', true)
    .is('archived_at', null)
    .is('duplicate_of', null)
    .eq('is_club_only', false)
    .not('image_url', 'is', null)
    .order('id', { ascending: true })
  if (!options.force) request = request.eq('tags', '{}')
  return request.range(from, from + PAGE_SIZE - 1)
}

async function loadArtworks() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from)
    if (error) fail(`No se pudieron leer las obras: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

function prompt(artwork) {
  const lines = [
    `You help the Mundial de Collage, a collage contest. Pick 3 to 6 tags for this obra from this list only: ${COMMUNITY_TAGS.join(', ')}.`,
    'Reply with JSON only, no explanations: {"tags":["..."]}',
  ]
  if (artwork.title) lines.push(`Title: ${JSON.stringify(artwork.title)}`)
  if (artwork.technique) lines.push(`Technique: ${artwork.technique}`)
  return lines.join('\n')
}

/** Tags only — no translations, no alt text, no verdict: this run is cheap. */
/** Sends the photo by URL; a photo the API rejects is shrunk and re-encoded once. */
async function imageContent(artwork) {
  if (artwork.encoded) {
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: artwork.encoded } }
  }
  return { type: 'image', source: { type: 'url', url: artwork.image_url } }
}

/** Downloads an image, fits it in 1600 px and re-encodes it as a plain JPEG. */
async function shrink(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`no se pudo bajar la imagen: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const jpeg = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return jpeg.toString('base64')
}

async function askTags(client, artwork) {
  try {
    return await callModel(client, artwork)
  } catch (error) {
    // The API refuses photos over 8000 px on a side and some odd JPEG
    // encodings. One re-encode is cheaper than leaving the obra untagged.
    if (error?.status !== 400 || artwork.encoded) throw error
    artwork.encoded = await shrink(artwork.image_url)
    return await callModel(client, artwork)
  }
}

async function callModel(client, artwork) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    // Same as lib/community-ai.ts: without this Haiku 5.5 spends the whole
    // budget on thinking and never writes the JSON.
    thinking: { type: 'disabled' },
    messages: [{
      role: 'user',
      content: [
        await imageContent(artwork),
        { type: 'text', text: prompt(artwork) },
      ],
    }],
  })
  const text = response.content.find((block) => block.type === 'text')?.text ?? ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    // Not silent: the usual cause is an exhausted budget before any text
    // (thinking is off now) or a model that answered in prose.
    const blocks = response.content.map((block) => block.type).join(',') || 'none'
    throw new Error(`respuesta sin JSON (stop_reason: ${response.stop_reason}, bloques: ${blocks})`)
  }
  try {
    const tags = cleanTags(JSON.parse(text.slice(start, end + 1)).tags)
    if (!tags.length) throw new Error('la respuesta no trajo etiquetas del vocabulario')
    return tags
  } catch (error) {
    if (error?.message === 'la respuesta no trajo etiquetas del vocabulario') throw error
    throw new Error(`JSON inválido: ${error?.message ?? error}`)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function tagOne(client, artwork) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(500 * attempt)
    try {
      const tags = await askTags(client, artwork)
      if (!tags.length) continue
      const { error } = await db.from('artworks').update({ tags }).eq('id', artwork.id)
      if (error) throw new Error(error.message)
      return tags
    } catch (error) {
      if (attempt === RETRIES) {
        console.error(`  falló ${artwork.slug ?? artwork.id}: ${error?.message ?? error}`)
      }
    }
  }
  return null
}

async function mapLimit(items, limit, worker) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}

const artworks = (await loadArtworks()).slice(0, options.limit)

if (options.dryRun) {
  console.log(`${artworks.length} obras candidatas${options.force ? ' (--force)' : ' sin etiquetas'}.`)
  if (artworks.length) console.log(`Primeras: ${artworks.slice(0, 10).map((row) => row.slug ?? row.id).join(', ')}`)
  process.exit(0)
}

if (!artworks.length) {
  console.log('Nada para etiquetar: todas las obras públicas ya tienen etiquetas.')
  process.exit(0)
}

const started = Date.now()
const client = new Anthropic()
let tagged = 0
let failed = 0
let done = 0

await mapLimit(artworks, options.concurrency, async (artwork) => {
  const tags = await tagOne(client, artwork)
  if (tags) tagged++
  else failed++
  done++
  if (done % 25 === 0 || done === artworks.length) {
    console.log(`${done}/${artworks.length} · etiquetadas ${tagged} · fallidas ${failed}`)
  }
})

const seconds = ((Date.now() - started) / 1000).toFixed(1)
console.log(`Listo en ${seconds}s: ${tagged} etiquetadas, ${artworks.length - tagged - failed} salteadas, ${failed} fallidas.`)
process.exit(failed ? 1 : 0)
