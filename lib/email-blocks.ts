// The visual email editor (components/admin/email-block-editor.tsx) edits an
// EmailDocument — a flat list of blocks — instead of raw HTML. This module is
// the single source of truth for what a block is and how it turns into the
// table-based, inline-styled HTML that actually survives email clients
// (Outlook's Word engine ignores flexbox/grid entirely, so no CSS layout
// here). It has no DOM/server-only APIs, so it's imported by both the client
// editor (for the live preview) and server actions (to persist body_html).
import { getSiteUrl } from '@/lib/site'

export type BlockAlign = 'left' | 'center' | 'right'
export type AccentColor = 'red' | 'blue' | 'ink'

export type EmailBlock =
  | { id: string; type: 'heading'; text: string; align: BlockAlign; size: 'sm' | 'md' | 'lg' }
  | { id: string; type: 'text'; text: string; align: BlockAlign }
  | { id: string; type: 'image'; url: string; alt: string; link: string; widthPct: number }
  | { id: string; type: 'button'; text: string; url: string; align: BlockAlign; color: AccentColor }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; size: 'sm' | 'md' | 'lg' }

export type EmailBlockType = EmailBlock['type']

export type EmailDocument = { blocks: EmailBlock[] }

// Exact hex from the brand guide (app/globals.css's --collage-red/blue/ink) —
// spelled out again here rather than read from CSS because email clients
// don't support CSS custom properties at send time.
const ACCENT_HEX: Record<AccentColor, string> = {
  red: '#D4302E',
  blue: '#11458C',
  ink: '#1B110C',
}

const HEADING_FONT_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: '18px',
  md: '24px',
  lg: '32px',
}

const SPACER_HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: '12px',
  md: '24px',
  lg: '48px',
}

let blockCounter = 0

// crypto.randomUUID needs a secure context, which isn't guaranteed for every
// admin browser/environment this runs in — a monotonic counter is all a
// block id needs (key for React lists + drag-and-drop, never persisted as a
// foreign key). Exported so the editor can mint one too (e.g. when
// duplicating a block) without reaching for Date.now()/Math.random() inside
// a component, which the react-hooks purity lint rule flags.
//
// The counter restarts on every page load while saved documents keep their
// old ids, so a random per-load prefix keeps a new block from reusing the id
// of one already in the document (translations are keyed by block id — see
// lib/email-translation.ts).
const sessionPrefix = Math.random().toString(36).slice(2, 7)

export function nextBlockId() {
  blockCounter += 1
  return `block-${sessionPrefix}${blockCounter}`
}

export function createBlock(type: EmailBlockType): EmailBlock {
  const id = nextBlockId()
  switch (type) {
    case 'heading':
      return { id, type, text: 'Título', align: 'left', size: 'md' }
    case 'text':
      return { id, type, text: 'Escribí el texto acá.', align: 'left' }
    case 'image':
      return { id, type, url: '', alt: '', link: '', widthPct: 100 }
    case 'button':
      return { id, type, text: 'Ver más', url: '', align: 'left', color: 'red' }
    case 'divider':
      return { id, type }
    case 'spacer':
      return { id, type, size: 'md' }
  }
}

export function createDefaultEmailDocument(): EmailDocument {
  const siteUrl = getSiteUrl()
  return {
    blocks: [
      { id: nextBlockId(), type: 'image', url: `${siteUrl}/logo.png`, alt: 'Mundial de Collage', link: '', widthPct: 40 },
      { id: nextBlockId(), type: 'spacer', size: 'sm' },
      { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}},', align: 'left', size: 'md' },
      {
        id: nextBlockId(),
        type: 'text',
        text: 'Escribí acá la novedad que querés contar. Podés dejar el saludo de arriba tal cual — se completa con el nombre de cada contacto.',
        align: 'left',
      },
      { id: nextBlockId(), type: 'button', text: 'Ver más', url: siteUrl, align: 'left', color: 'red' },
      { id: nextBlockId(), type: 'divider' },
      {
        id: nextBlockId(),
        type: 'text',
        text: 'Mundial Internacional de Collage',
        align: 'center',
      },
    ],
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const NOMBRE_TOKEN = /\{\{\s*nombre\s*\}\}/gi

// Values used only in the admin preview. They make system-template tags
// readable without accidentally looking like data from a real contact.
const PREVIEW_TAG_VALUES: Record<string, string> = {
  nombre: 'Camila Fernández',
  obra: 'La ciudad que imaginé',
  likes: '12',
  likes_total: '84',
  comentarios: '“Qué hermosa composición.” — Julieta',
  link_obra: `${getSiteUrl()}/galeria-3d?obra=ejemplo`,
  email: 'camila.fernandez@example.com',
  pais: 'Argentina',
  país: 'Argentina',
  ciudad: 'Mar del Plata',
  fecha: '15 de octubre',
}

function previewValueForTag(tag: string) {
  const normalized = tag.trim().toLocaleLowerCase('es-AR')
  const value = PREVIEW_TAG_VALUES[normalized]
  if (value) return value

  // A new tag still renders as something meaningful while its eventual
  // delivery data is being implemented, e.g. {{nombre_evento}} becomes
  // "Nombre evento de ejemplo" rather than a bare template token.
  const label = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${label.charAt(0).toLocaleUpperCase('es-AR')}${label.slice(1)} de ejemplo`
}

/** Replaces merge tags with safe, coherent sample data in the admin preview. */
export function renderEmailPreviewHtml(html: string): string {
  return html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, tag: string) => escapeHtml(previewValueForTag(tag)))
}

// Fills in the {{nombre}} merge tag the default template's greeting uses
// (createDefaultEmailDocument above) with each recipient's name at send
// time. Without a name, drop the token along with an adjacent comma so
// "Hola {{nombre}}," doesn't leave a dangling "Hola ," behind.
export function personalizeHtml(html: string, name: string | null | undefined): string {
  const trimmedName = name?.trim()
  if (trimmedName) {
    // A replacer function, not a string: String.replace() treats a string
    // replacement's $&, $$, $` and $' as special patterns, so a name
    // containing one of those (e.g. "Bio$$hop") would otherwise come out
    // mangled instead of literal.
    const escapedName = escapeHtml(trimmedName)
    return html.replace(NOMBRE_TOKEN, () => escapedName)
  }
  return html
    .replace(/\s?\{\{\s*nombre\s*\}\}\s*,/gi, '')
    .replace(/,\s*\{\{\s*nombre\s*\}\}\s?/gi, '')
    .replace(NOMBRE_TOKEN, '')
    .replace(/[ \t]{2,}/g, ' ')
}

// Plain-text blocks only ever need line breaks preserved — anything richer
// (bold, links inline) would need a real rich-text model, out of scope for
// the block editor's first version.
function textToHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />')
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return `<tr><td style="padding:0 0 16px;text-align:${block.align};font-size:${HEADING_FONT_SIZE[block.size]};font-weight:700;color:${ACCENT_HEX.ink};font-family:Georgia,'Times New Roman',serif;">${textToHtml(block.text)}</td></tr>`

    case 'text':
      return `<tr><td style="padding:0 0 16px;text-align:${block.align};font-size:15px;line-height:1.6;color:${ACCENT_HEX.ink};font-family:Arial,Helvetica,sans-serif;">${textToHtml(block.text)}</td></tr>`

    case 'image': {
      if (!block.url) return ''
      const img = `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" width="${block.widthPct}%" style="display:block;width:${block.widthPct}%;max-width:100%;height:auto;border:0;" />`
      const wrapped = block.link ? `<a href="${escapeHtml(block.link)}" target="_blank" rel="noopener noreferrer">${img}</a>` : img
      return `<tr><td style="padding:0 0 16px;">${wrapped}</td></tr>`
    }

    case 'button': {
      if (!block.url) return ''
      const color = ACCENT_HEX[block.color]
      const justify = block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start'
      return `<tr><td style="padding:0 0 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${justify === 'center' ? '0 auto' : justify === 'flex-end' ? '0 0 0 auto' : '0'};"><tr><td style="border-radius:8px;background:${color};"><a href="${escapeHtml(block.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(block.text)}</a></td></tr></table></td></tr>`
    }

    case 'divider':
      return `<tr><td style="padding:0 0 16px;"><hr style="border:none;border-top:1px solid #ddd;margin:0;" /></td></tr>`

    case 'spacer':
      return `<tr><td style="height:${SPACER_HEIGHT[block.size]};line-height:${SPACER_HEIGHT[block.size]};font-size:1px;">&nbsp;</td></tr>`
  }
}

export function renderEmailDocumentToHtml(doc: EmailDocument): string {
  const rows = doc.blocks.map(renderBlock).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ee;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;padding:32px;">${rows}</table></td></tr></table>`
}

export function isEmailDocument(value: unknown): value is EmailDocument {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as EmailDocument).blocks)
  )
}
