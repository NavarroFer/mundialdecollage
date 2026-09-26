'use client'

import { Analytics } from '@vercel/analytics/next'

// Vercel Web Analytics: visitas y páginas vistas, sin cookies. Como con
// Clarity, /admin queda afuera para no contar a quien administra el sitio.
// Fuera de un deploy de Vercel (npm run dev) solo loguea en la consola.
export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => (new URL(event.url).pathname.startsWith('/admin') ? null : event)}
    />
  )
}
