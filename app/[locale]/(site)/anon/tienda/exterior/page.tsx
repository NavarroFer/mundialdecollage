import { renderAsAnonymous } from '@/lib/render-mode'
import { StoreView } from '../../../tienda/store-view'

// /tienda for visitors with nothing personal (lib/static-pages.ts), in
// dollars with PayPal (anywhere but Argentina). proxy.ts picks the region
// from ?envio= or the visitor's country, as the page itself does, so this
// copy reads neither. Built per language and redrawn once a day: the
// store's content only changes with a deploy.
export const revalidate = 86400

export default function AnonymousAbroadStorePage() {
  renderAsAnonymous()
  return <StoreView argentina={false} />
}
