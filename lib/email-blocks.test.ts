import { describe, expect, it } from 'vitest'
import { createDefaultEmailDocument, renderEmailDocumentToHtml, type EmailDocument } from './email-blocks'

// The block editor lets admins type free-form text into heading/text blocks —
// this is the one place that turns it into HTML, so it's also the one place
// that has to escape it. A missed escape here means anything typed into a
// campaign body (even accidentally, like a stray "<" while writing "if x<y")
// could break the layout or, worse, inject markup into a mail sent to every
// subscribed contact.
describe('renderEmailDocumentToHtml', () => {
  it('escapes HTML special characters in heading and text blocks', () => {
    const doc: EmailDocument = {
      blocks: [
        { id: '1', type: 'heading', text: '<script>alert(1)</script>', align: 'left', size: 'md' },
        { id: '2', type: 'text', text: 'Tom & Jerry "quoted"', align: 'left' },
      ],
    }
    const html = renderEmailDocumentToHtml(doc)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Tom &amp; Jerry &quot;quoted&quot;')
  })

  it('preserves line breaks in text blocks as <br />', () => {
    const doc: EmailDocument = { blocks: [{ id: '1', type: 'text', text: 'línea uno\nlínea dos', align: 'left' }] }
    expect(renderEmailDocumentToHtml(doc)).toContain('línea uno<br />línea dos')
  })

  it('skips image and button blocks with no url instead of emitting a broken tag', () => {
    const doc: EmailDocument = {
      blocks: [
        { id: '1', type: 'image', url: '', alt: '', link: '', widthPct: 100 },
        { id: '2', type: 'button', text: 'Ver más', url: '', align: 'left', color: 'red' },
      ],
    }
    const html = renderEmailDocumentToHtml(doc)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<a href=')
  })

  it('renders an image with a url as a sized, non-fluid <img>', () => {
    const doc: EmailDocument = {
      blocks: [{ id: '1', type: 'image', url: 'https://example.com/a.png', alt: 'Logo', link: '', widthPct: 40 }],
    }
    const html = renderEmailDocumentToHtml(doc)
    expect(html).toContain('src="https://example.com/a.png"')
    expect(html).toContain('width="40%"')
  })

  it('always wraps the document in the shared 600px container regardless of block count', () => {
    expect(renderEmailDocumentToHtml({ blocks: [] })).toContain('width:600px')
  })

  it('produces a non-empty default/base document with a functioning render', () => {
    const doc = createDefaultEmailDocument()
    expect(doc.blocks.length).toBeGreaterThan(0)
    const html = renderEmailDocumentToHtml(doc)
    expect(html).toContain('{{nombre}}')
  })
})
