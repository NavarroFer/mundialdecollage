import Anthropic from '@anthropic-ai/sdk'
import { TRANSLATED_LOCALES, type Locale } from '@/lib/i18n/locales'
import { COMMUNITY_TAGS, cleanTags } from '@/lib/community-tags'
import { readAiModerationEnabled } from '@/lib/community-settings'
import { createAdminClient } from '@/lib/supabase/admin'

// The current small model (Claude API id, Nov 2026). Haiku 4.5
// (claude-haiku-4-5-20251001) is legacy. One call per post, never per visit.
// COMMUNITY_AI=off or a missing key skips every call. The admin switch
// (community_settings.ai_moderation) skips only the moderation label.
const MODEL = 'claude-haiku-5-5'

export type CommunityReading = {
  lang: string | null
  translations: Partial<Record<Locale, string>>
  imageAlt: string | null
  tags: string[]
  verdict: 'ok' | 'dudoso' | 'rechazar' | null
  reason: string | null
}

const EMPTY: CommunityReading = { lang: null, translations: {}, imageAlt: null, tags: [], verdict: null, reason: null }

/** Why every Comunidad model call is forced off, if it is. */
export function communityAiBlocks(): { env: boolean; key: boolean } {
  return {
    env: process.env.COMMUNITY_AI === 'off',
    key: !process.env.ANTHROPIC_API_KEY,
  }
}

export function isCommunityAiOn(): boolean {
  const blocks = communityAiBlocks()
  return !blocks.env && !blocks.key
}

/** Moderation labels only. Translation and tags still run when the model is on. */
export async function isCommunityModerationOn(): Promise<boolean> {
  if (!isCommunityAiOn()) return false
  return readAiModerationEnabled()
}

const LOCALES = new Set<string>(['es', ...TRANSLATED_LOCALES])

/** Turns the model's JSON into a reading. A bad payload is empty, never a throw. */
export function parseCommunityReading(raw: string, options: { translate: boolean; describe: boolean; moderate: boolean }): CommunityReading {
  try {
    const parsed = JSON.parse(raw) as {
      lang?: unknown
      translations?: unknown
      imageAlt?: unknown
      tags?: unknown
      verdict?: unknown
      reason?: unknown
    }
    const lang = typeof parsed.lang === 'string' && LOCALES.has(parsed.lang) ? parsed.lang : null
    const translations: CommunityReading['translations'] = {}
    if (options.translate && parsed.translations && typeof parsed.translations === 'object') {
      for (const [key, value] of Object.entries(parsed.translations)) {
        if (LOCALES.has(key) && key !== lang && typeof value === 'string' && value.trim()) {
          translations[key as Locale] = value.trim()
        }
      }
    }
    const verdict = parsed.verdict === 'ok' || parsed.verdict === 'dudoso' || parsed.verdict === 'rechazar' ? parsed.verdict : null
    return {
      lang,
      translations,
      imageAlt: options.describe && typeof parsed.imageAlt === 'string' && parsed.imageAlt.trim() ? parsed.imageAlt.trim().slice(0, 200) : null,
      tags: cleanTags(parsed.tags),
      verdict: options.moderate ? verdict : null,
      reason: options.moderate && typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 200) : null,
    }
  } catch {
    return EMPTY
  }
}

/** Tags-only payload. Unknown tags are dropped; a broken payload is empty, never a throw. */
export function parseArtworkTags(raw: string): string[] {
  const candidates = [raw]
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) candidates.push(raw.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { tags?: unknown }
      const tags = cleanTags(parsed?.tags)
      if (tags.length) return tags
    } catch {
      // Try the next shape (raw, then the JSON inside surrounding text).
    }
  }
  return []
}

function prompt(task: { body: string; describe: boolean; moderate: boolean }): string {
  return `You help the Mundial de Collage, a collage community. Reply with JSON only.
${task.body.trim().length >= 3 ? `Text: ${JSON.stringify(task.body)}
Detect its language as one of es, en, pt, it, fr, de, pl, ru, id. Translate the text into the other eight languages. Skip translation keys you cannot fill.` : 'There is no text to translate. Set lang to null and translations to {}.'}
${task.describe ? 'Describe the image in one short Spanish line (imageAlt) for someone who cannot see it. It is a collage or a photo of making one.' : 'Set imageAlt to null.'}
Pick 3 to 6 tags from this list only: ${COMMUNITY_TAGS.join(', ')}.
${task.moderate ? 'Also set verdict to ok, dudoso or rechazar (nudity that is not artistic, spam, insult, advertising, or not collage and not a working process) and reason to one Spanish line.' : 'Set verdict and reason to null.'}
Shape: {"lang":"es","translations":{"en":"…"},"imageAlt":null,"tags":[],"verdict":null,"reason":null}`
}

async function ask(task: { body: string; imageUrl?: string | null; describe: boolean; moderate: boolean }): Promise<CommunityReading> {
  if (!isCommunityAiOn()) return EMPTY
  if (task.body.trim().length < 3 && !task.imageUrl) return EMPTY
  try {
    const client = new Anthropic()
    const content: Anthropic.MessageCreateParams['messages'][number]['content'] = [{ type: 'text', text: prompt(task) }]
    if (task.imageUrl && task.describe) content.push({ type: 'image', source: { type: 'url', url: task.imageUrl } })
    const response = await client.messages.create({
      model: MODEL,
      // Haiku 5.5 thinks by default, so the budget also covers thinking. The
      // answer (eight translations plus tags) needs room after it.
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    })
    const text = response.content.find((block) => block.type === 'text')?.text ?? ''
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    return parseCommunityReading(json, { translate: task.body.trim().length >= 3, describe: task.describe, moderate: task.moderate })
  } catch (error) {
    console.error('community ai', error)
    return EMPTY
  }
}

const TAGS_INSTRUCTIONS = `You help the Mundial de Collage, a collage contest. Pick 3 to 6 tags for this obra from this list only: ${COMMUNITY_TAGS.join(', ')}.
Reply with JSON only, no explanations: {"tags":["..."]}`

/** Tags only — no translations, no alt text, no verdict: the cheap call. A bad payload is empty. */
async function askTags(task: { title: string | null; technique: string | null; imageUrl: string }): Promise<string[]> {
  if (!isCommunityAiOn()) return []
  try {
    const client = new Anthropic()
    const lines = [TAGS_INSTRUCTIONS]
    if (task.title) lines.push(`Title: ${JSON.stringify(task.title)}`)
    if (task.technique) lines.push(`Technique: ${task.technique}`)
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      // Haiku 5.5 thinks by default and spends the whole budget before writing
      // the JSON (stop_reason: max_tokens, no text block). Tagging needs one
      // short answer, so thinking is off; the other calls keep it on.
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: task.imageUrl } },
          { type: 'text', text: lines.join('\n') },
        ],
      }],
    })
    const text = response.content.find((block) => block.type === 'text')?.text ?? ''
    return parseArtworkTags(text)
  } catch (error) {
    console.error('community ai tags', error)
    return []
  }
}

/**
 * Tags one existing obra. No-op when the model is off, the obra is gone, has
 * no photo, or was already tagged (the community post flow may have done it).
 * Tagging never breaks the action that triggered it.
 */
export async function tagArtwork(artworkId: string): Promise<void> {
  if (!artworkId || !isCommunityAiOn()) return
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('artworks')
      .select('title, technique, image_url, tags')
      .eq('id', artworkId)
      .maybeSingle()
    const artwork = data as { title: string | null; technique: string | null; image_url: string | null; tags: string[] | null } | null
    if (!artwork?.image_url || artwork.tags?.length) return
    const tags = await askTags({ title: artwork.title, technique: artwork.technique, imageUrl: artwork.image_url })
    if (!tags.length) return
    await admin.from('artworks').update({ tags }).eq('id', artworkId)
  } catch (error) {
    console.error('community ai artwork tags', error)
  }
}

/** Fills language, alt text, tags and, when moderation is on, a hint for a pending photo or comment. Failures stay empty. */
export async function enrichCommunityPost(postId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin.from('posts').select('id, kind, body, image_path, artwork_id, status').eq('id', postId).maybeSingle()
  const post = data as { id: string; kind: string; body: string; image_path: string | null; artwork_id: string | null; status: string } | null
  if (!post) return
  let imageUrl: string | null = null
  let title: string | null = null
  if (post.artwork_id) {
    const artwork = await admin.from('artworks').select('title, image_url').eq('id', post.artwork_id).maybeSingle()
    title = (artwork.data as { title: string | null; image_url: string | null } | null)?.title ?? null
    imageUrl = (artwork.data as { image_url: string | null } | null)?.image_url ?? null
  } else if (post.image_path) {
    imageUrl = admin.storage.from('posts').getPublicUrl(post.image_path).data.publicUrl
  }
  const reading = await ask({
    body: post.body,
    imageUrl,
    describe: post.kind !== 'artwork',
    moderate: post.status === 'pending' && await isCommunityModerationOn(),
  })
  await admin.from('posts').update({
    lang: reading.lang,
    translations: reading.translations,
    image_alt: post.kind === 'artwork' ? title : reading.imageAlt,
    tags: reading.tags,
    ai_verdict: reading.verdict,
    ai_reason: reading.reason,
  }).eq('id', postId)
  if (post.artwork_id && reading.tags.length) {
    await admin.from('artworks').update({ tags: reading.tags }).eq('id', post.artwork_id)
  }
}

export async function enrichCommunityComment(commentId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin.from('post_comments').select('id, body, status').eq('id', commentId).maybeSingle()
  const comment = data as { id: string; body: string; status: string } | null
  if (!comment) return
  const reading = await ask({ body: comment.body, describe: false, moderate: comment.status === 'pending' && await isCommunityModerationOn() })
  await admin.from('post_comments').update({
    lang: reading.lang,
    translations: reading.translations,
    ai_verdict: reading.verdict,
    ai_reason: reading.reason,
  }).eq('id', commentId)
}
