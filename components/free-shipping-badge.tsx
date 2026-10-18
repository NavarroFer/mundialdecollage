import { Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

// «Envío gratis» next to a peso price, as loud as Mercado Libre puts it:
// the price already has the flat Correo tariff in it (lib/correo.ts
// priceWithShippingArs), so the buyer pays exactly what the card says.
export function FreeShippingBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('torn-strip inline-flex w-fit items-center gap-1.5 bg-free-shipping px-3 py-1 text-xs font-bold tracking-[0.14em] text-paper uppercase', className)}>
      <Truck className="size-[1.4em] shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}
