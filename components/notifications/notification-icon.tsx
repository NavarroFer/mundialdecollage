import {
  Banknote,
  Heart,
  ImageOff,
  ImagePlus,
  Inbox,
  Landmark,
  MessageCircle,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import type { NotificationIcon as IconName } from '@/lib/notifications/registry'
import { cn } from '@/lib/utils'

const ICONS: Record<IconName, { Icon: LucideIcon; tone: string }> = {
  comment: { Icon: MessageCircle, tone: 'bg-collage-blue/15 text-collage-blue' },
  wall: { Icon: ImagePlus, tone: 'bg-collage-yellow/30 text-ink' },
  wallRejected: { Icon: ImageOff, tone: 'bg-ink/10 text-ink' },
  activity: { Icon: Heart, tone: 'bg-collage-red/15 text-collage-red' },
  exhibition: { Icon: Landmark, tone: 'bg-collage-blue/15 text-collage-blue' },
  referral: { Icon: UserPlus, tone: 'bg-collage-yellow/30 text-ink' },
  pending: { Icon: Inbox, tone: 'bg-collage-yellow/30 text-ink' },
  alert: { Icon: TriangleAlert, tone: 'bg-collage-red/15 text-collage-red' },
  image: { Icon: ImageOff, tone: 'bg-collage-red/15 text-collage-red' },
  money: { Icon: Banknote, tone: 'bg-collage-blue/15 text-collage-blue' },
}

export function NotificationIcon({ name, className }: { name: IconName; className?: string }) {
  const { Icon, tone } = ICONS[name]
  return (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone, className)} aria-hidden="true">
      <Icon className="h-4.5 w-4.5" />
    </span>
  )
}
