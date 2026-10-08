// Gives the pages a layout below the root one: Next composes not-found.tsx
// and error.tsx on the server only under a layout like this, not next to a
// root layout that sits in a dynamic segment (app/[locale]/layout.tsx).
import { RouteTransition } from '@/components/route-transition'
import { ObraModalProvider } from '@/components/obra-modal'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ObraModalProvider>
      <RouteTransition>{children}</RouteTransition>
    </ObraModalProvider>
  )
}
