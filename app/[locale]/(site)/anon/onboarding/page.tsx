import { renderAsAnonymous } from '@/lib/render-mode'
import OnboardingPage from '../../onboarding/page'

// The anonymous copy of /onboarding (lib/static-pages.ts): built per language,
// refreshed at most every 5 minutes or right away when the app changes its data
// (lib/public-data-cache.ts).
export const revalidate = 300

export default function AnonymousOnboardingPage() {
  renderAsAnonymous()
  return <OnboardingPage searchParams={Promise.resolve({})} />
}
