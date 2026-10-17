import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CallChip } from './call-chip'

vi.stubGlobal('React', React)

const labels = { idle: 'en espera', running: 'subiendo', done: 'subida', error: 'no se pudo subir', retry: 'Volver a subir' }

describe('CallChip', () => {
  it('says what it is and how it went, in the words it was given', () => {
    const html = renderToStaticMarkup(<CallChip name="Obra 1" argument="foto.jpg" status="done" labels={labels} />)
    expect(html).toContain('Obra 1 foto.jpg: subida')
    expect(html).toContain('role="status"')
  })

  it('leaves the announcing to a parent when it is not live', () => {
    const html = renderToStaticMarkup(<CallChip name="Obra 1" argument="foto.jpg" status="running" labels={labels} live={false} />)
    expect(html).not.toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
  })

  it('offers a retry only once it failed, and only with somewhere to send it', () => {
    const retry = (status: 'running' | 'error', onRetry?: () => void) =>
      renderToStaticMarkup(<CallChip name="Obra 2" argument="b.jpg" status={status} labels={labels} onRetry={onRetry} />)
    expect(retry('error', () => {})).toContain('aria-label="Volver a subir: Obra 2 b.jpg"')
    expect(retry('running', () => {})).not.toContain('<button')
    expect(retry('error')).not.toContain('<button')
  })
})
