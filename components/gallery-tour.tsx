'use client'

import { useEffect } from 'react'

// Triggered by linking to `/#tour-galeria` (see the admin panel's "Ver
// galería 3D" button) — scrolls the visitor past the real artwork gallery
// and on to the map, instead of dropping them there instantly.
const TOUR_HASH = '#tour-galeria'
const TOUR_STEPS = ['participantes', 'mapa']
const STEP_DELAY_MS = 1100

function runTour() {
  TOUR_STEPS.forEach((id, index) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, index * STEP_DELAY_MS)
  })
}

export function GalleryTour() {
  useEffect(() => {
    if (window.location.hash !== TOUR_HASH) return

    // Drop the hash immediately so the browser's own jump-to-anchor never
    // fights the animated scroll, and so reloading doesn't replay the tour.
    history.replaceState(null, '', window.location.pathname + window.location.search)

    const content = document.getElementById('site-content')
    if (!content?.hasAttribute('inert')) {
      runTour()
      return
    }

    // SplashScreen marks #site-content inert while it covers the page —
    // wait for it to lift, otherwise the whole tour scrolls unseen behind it.
    const observer = new MutationObserver(() => {
      if (!content.hasAttribute('inert')) {
        observer.disconnect()
        runTour()
      }
    })
    observer.observe(content, { attributes: true, attributeFilter: ['inert'] })
    return () => observer.disconnect()
  }, [])

  return null
}
