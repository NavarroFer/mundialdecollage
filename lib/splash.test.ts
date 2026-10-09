import { describe, expect, it } from 'vitest'
import { HIDE_SEEN_SPLASH_SCRIPT, SPLASH_SEEN_KEY } from './splash'

// Runs the <head> script against a stand-in document and returns the CSS it added.
function runHeadScript(stored: Record<string, string>, { throws = false } = {}) {
  const added: { textContent: string }[] = []
  const localStorage = {
    getItem: (key: string) => {
      if (throws) throw new Error('blocked')
      return stored[key] ?? null
    },
  }
  const document = {
    createElement: () => ({ textContent: '' }),
    head: { appendChild: (node: { textContent: string }) => (added.push(node), node) },
  }
  new Function('localStorage', 'document', HIDE_SEEN_SPLASH_SCRIPT)(localStorage, document)
  return added.map((node) => node.textContent)
}

describe('HIDE_SEEN_SPLASH_SCRIPT', () => {
  it('hides the cover for a visitor who already saw it', () => {
    expect(runHeadScript({ [SPLASH_SEEN_KEY]: '1' })).toEqual(['[data-splash]{display:none}'])
  })

  it('leaves the cover for a first visit', () => {
    expect(runHeadScript({})).toEqual([])
  })

  it('leaves the cover when storage is blocked', () => {
    expect(runHeadScript({ [SPLASH_SEEN_KEY]: '1' }, { throws: true })).toEqual([])
  })
})
