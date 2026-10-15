import { renderAsAnonymous } from '@/lib/render-mode'
import DonationThanksPage, { generateMetadata as pageMetadata } from '../../../donar/gracias/page'

// The anonymous copy of /donar/gracias (lib/static-pages.ts): built per
// language. Nothing on it changes, so the day is only a backstop.
export const revalidate = 86400

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousDonationThanksPage() {
  renderAsAnonymous()
  return <DonationThanksPage />
}
