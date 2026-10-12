'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

// Sin NEXT_PUBLIC_CLARITY_PROJECT_ID no se inyecta nada (ver README). Se
// excluye /admin para no grabar la sesión de quien administra el sitio junto
// con la de los visitantes.
//
// El script y las grabaciones van directamente a Microsoft: no consumen
// invocaciones ni transferencia de nuestras Functions en Vercel. Los
// bloqueadores de privacidad pueden impedir la grabación de esa sesión.
//
// lazyOnload: Clarity copia el DOM entero al arrancar y escucha cada toque;
// cargado después del load, en tiempo ocioso, no compite con la hidratación
// ni con los primeros toques del visitante.
export function ClarityAnalytics() {
  const pathname = usePathname()

  if (!CLARITY_PROJECT_ID || pathname?.startsWith('/admin')) return null

  return (
    <Script id="clarity-analytics" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  )
}
