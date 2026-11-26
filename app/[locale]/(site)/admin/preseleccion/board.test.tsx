import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PreselectionBoard, type BoardItem } from './board'

vi.stubGlobal('React', React)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./actions', () => ({ chooseObra: vi.fn(), closeBatch: vi.fn(), reopenBatch: vi.fn(), sendToJury: vi.fn(), setPicks: vi.fn() }))

const items: BoardItem[] = Array.from({ length: 20 }, (_, i) => ({
  key: `artwork:${i}`, obraKey: `artwork:${i}`, imageUrl: `https://x.invalid/${i}.jpg`, title: `Obra ${i}`,
  technique: 'Mixta', artist: `Artista ${i}`, artistKey: `profile:${i}`, countryCode: 'AR', alternatives: [],
}))

const base = {
  stage: 1 as const, items, counts: { total: 1700, seen: 100, remaining: 1600, pickedSeen: 31, picked: 36, projected: 510, target: 340 },
  batchNumber: 6, batchCount: 85, batchSize: 20, columns: 5, targetPercent: 20, tileWidth: 640, preload: [],
  links: { batch: '/b', picked: '/p', options: new Proxy({}, { get: () => '/o' }) as Record<string, string> },
}

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

describe('PreselectionBoard counters', () => {
  it('counts this batch and the whole pass, each with its percentage', () => {
    const html = text(renderToStaticMarkup(<PreselectionBoard {...base} mode="batch" initialPicked={items.slice(0, 5).map((i) => i.key)} />))
    expect(html).toContain('Esta tanda · 6 de 85')
    // 5 of the 20 on screen.
    expect(html).toContain('5 de 20 elegidas · 25%')
    // 31 picked among 100 seen, plus this batch: 36 of 120.
    expect(html).toContain('36 de 120 vistas · 30%')
    expect(html).toContain('Quedan 1580 de 1700 por ver')
    expect(html).toContain('a este ritmo terminan en ~510 (meta ~340)')
    expect(html).toContain('vienen eligiendo de más')
  })

  it('has no cap: every obra of a batch can be picked', () => {
    const html = text(renderToStaticMarkup(<PreselectionBoard {...base} mode="batch" initialPicked={items.map((i) => i.key)} />))
    expect(html).toContain('20 de 20 elegidas · 100%')
  })

  it('shows the final table against the 50–60 goal and flags an artist picked twice', () => {
    const twice = [...items, { ...items[0], key: 'artwork:99', obraKey: 'artwork:99', title: 'Otra' }]
    const html = text(renderToStaticMarkup(<PreselectionBoard {...base} stage={3} mode="final" items={twice} initialPicked={['artwork:0', 'artwork:99']} />))
    expect(html).toContain('2 marcadas de 21 · 10%')
    expect(html).toContain('faltan 48')
    expect(html).toContain('Artista 0: Obra 0 · Otra')
  })
})
