import { headers } from 'next/headers'
import { StoreView } from './store-view'

// Argentina pays in pesos with Mercado Pago, everywhere else in dollars with
// PayPal. ?envio=ar|exterior picks one; without it, the visitor's country
// (Vercel's geolocation header) decides, and Argentina when it's unknown.
// This is the page for visitors with a session or a ?desde= link; the rest
// get a prebuilt copy per region (anon/tienda, proxy.ts storeRegion).
export default async function StorePage({ searchParams }: { searchParams: Promise<{ desde?: string; envio?: string }> }) {
  const [{ desde, envio }, requestHeaders] = await Promise.all([searchParams, headers()])
  const visitorCountry = requestHeaders.get('x-vercel-ip-country')
  const argentina = envio === 'ar' || (envio !== 'exterior' && (!visitorCountry || visitorCountry === 'AR'))
  return <StoreView argentina={argentina} desde={desde} />
}
