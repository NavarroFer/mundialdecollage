'use client'

import { useEffect } from 'react'

export function StampVisit({ stamp }: { stamp: 'gallery' | 'world' }) {
  useEffect(() => { void fetch('/api/stamps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stamp }) }) }, [stamp])
  return null
}
