import {
  Bookmark,
  CalendarCheck,
  Compass,
  Crown,
  Frame,
  Heart,
  HeartHandshake,
  ImagePlus,
  Landmark,
  Library,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Scissors,
  Send,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { MAP_SECTION_ID } from '@/lib/map-country-link'
import { ALBUM_HREF, type StampKey } from '@/lib/stamps'

// How each stamp looks wherever it shows (the home album, the gallery
// passport, the toast, the share image) and where to go to earn it.
// `paper`/`ink` are hex because the share image draws them on a canvas.

type Tone = 'red' | 'yellow' | 'blue' | 'ink'

export const STAMP_TONES: Record<Tone, { paper: string; ink: string; className: string }> = {
  red: { paper: '#D4302E', ink: '#FAF8F2', className: 'bg-collage-red text-paper' },
  yellow: { paper: '#E79D00', ink: '#1B110C', className: 'bg-collage-yellow text-ink' },
  blue: { paper: '#11458C', ink: '#FAF8F2', className: 'bg-collage-blue text-paper' },
  ink: { paper: '#1B110C', ink: '#E79D00', className: 'bg-ink text-collage-yellow' },
}

type StampLook = { Icon: LucideIcon; tone: Tone; tilt: string; href: string }

export const STAMP_LOOKS: Record<StampKey, StampLook> = {
  gallery: { Icon: Scissors, tone: 'yellow', tilt: 'rotate-2', href: '/galeria-3d' },
  world: { Icon: Compass, tone: 'blue', tilt: '-rotate-1', href: `/#${MAP_SECTION_ID}` },
  like: { Icon: Heart, tone: 'red', tilt: '-rotate-2', href: '/galeria-3d' },
  fan: { Icon: HeartHandshake, tone: 'red', tilt: 'rotate-1', href: '/galeria-3d' },
  collector: { Icon: Bookmark, tone: 'yellow', tilt: '-rotate-1', href: '/galeria-3d' },
  curator: { Icon: Library, tone: 'blue', tilt: 'rotate-2', href: '/galeria-3d' },
  archive: { Icon: Landmark, tone: 'ink', tilt: '-rotate-2', href: '/galeria-3d' },
  regular: { Icon: CalendarCheck, tone: 'blue', tilt: 'rotate-1', href: '/galeria-3d' },
  comment: { Icon: MessageCircle, tone: 'yellow', tilt: '-rotate-1', href: '/galeria-3d' },
  wall: { Icon: ImagePlus, tone: 'red', tilt: 'rotate-2', href: '/galeria-3d' },
  first: { Icon: Send, tone: 'red', tilt: '-rotate-3', href: '/onboarding' },
  post: { Icon: Megaphone, tone: 'yellow', tilt: 'rotate-1', href: '/comunidad' },
  exhibited: { Icon: Frame, tone: 'blue', tilt: '-rotate-2', href: '/galeria-3d' },
  ambassador: { Icon: UserPlus, tone: 'red', tilt: 'rotate-2', href: '/mi-perfil' },
  applause: { Icon: PartyPopper, tone: 'yellow', tilt: '-rotate-1', href: '/mi-perfil' },
  legend: { Icon: Crown, tone: 'ink', tilt: 'rotate-1', href: ALBUM_HREF },
}
