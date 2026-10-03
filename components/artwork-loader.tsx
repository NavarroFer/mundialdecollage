import { cn } from '@/lib/utils'
import './artwork-loader.css'

/** Torn paper scraps pasting themselves in a loop while an artwork loads. */
export function ArtworkLoader({ className }: { className?: string }) {
  return (
    <div className={cn('artwork-loader', className)} aria-hidden="true">
      <span className="artwork-loader__scrap artwork-loader__scrap--blue" />
      <span className="artwork-loader__scrap artwork-loader__scrap--red" />
      <span className="artwork-loader__scrap artwork-loader__scrap--yellow" />
    </div>
  )
}
