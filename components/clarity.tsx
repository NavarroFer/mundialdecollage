'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

// Sin NEXT_PUBLIC_CLARITY_PROJECT_ID no se inyecta nada (ver README). Se
// excluye /admin para no grabar la sesión de quien administra el sitio junto
// con la de los visitantes.
export function ClarityAnalytics() {
  const pathname = usePathname()

  if (!CLARITY_PROJECT_ID || pathname?.startsWith('/admin')) return null

  return (
    <Script id="clarity-analytics" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  )
}
