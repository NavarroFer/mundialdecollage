import {
  Users,
  FileText,
  Send,
  Images,
  BarChart3,
  MessageSquare,
  CreditCard,
  Boxes,
  BookOpen,
  Package,
  Gavel,
  Megaphone,
  ShoppingBag,
  Landmark,
  Mail,
  Flag,
  Gauge,
} from 'lucide-react'

export type AdminNavItem = {
  href: string
  label: string
  icon: typeof Images
  description?: string
  external?: boolean
}

// Full class strings (not built from the color name) so Tailwind sees them.
// Ocre carries ink text: paper on #e79d00 fails contrast.
const tones = {
  blue: {
    tile: 'bg-collage-blue/[0.06] border-collage-blue/20',
    bar: 'bg-collage-blue',
    active: 'bg-collage-blue text-paper shadow-sm',
    hover: 'hover:bg-collage-blue/10 hover:text-collage-blue',
    badge: 'bg-collage-blue text-paper',
  },
  red: {
    tile: 'bg-collage-red/[0.06] border-collage-red/20',
    bar: 'bg-collage-red',
    active: 'bg-collage-red text-paper shadow-sm',
    hover: 'hover:bg-collage-red/10 hover:text-collage-red',
    badge: 'bg-collage-red text-paper',
  },
  yellow: {
    tile: 'bg-collage-yellow/10 border-collage-yellow/30',
    bar: 'bg-collage-yellow',
    active: 'bg-collage-yellow text-ink shadow-sm',
    hover: 'hover:bg-collage-yellow/20 hover:text-ink',
    badge: 'bg-collage-yellow text-ink',
  },
  ink: {
    tile: 'bg-ink/[0.04] border-ink/15',
    bar: 'bg-ink',
    active: 'bg-ink text-paper shadow-sm',
    hover: 'hover:bg-ink/10 hover:text-ink',
    badge: 'bg-ink text-paper',
  },
}

export type AdminTone = (typeof tones)[keyof typeof tones]

// Group labels match the eyebrows each admin page shows above its title.
export const adminSections: {
  label: string
  icon: typeof Images
  tone: AdminTone
  items: AdminNavItem[]
}[] = [
  {
    label: 'Convocatoria',
    icon: Megaphone,
    tone: tones.blue,
    items: [
      {
        href: '/admin/obras',
        label: 'Obras',
        icon: Images,
        description:
          'Revisá las obras que llegaron, elegí cuál cuenta de cada artista y corregí sus datos.',
      },
      {
        href: '/admin/estadisticas',
        label: 'Estadísticas',
        icon: BarChart3,
        description:
          'Cuántas obras llegaron, desde qué países y con qué técnicas.',
      },
      {
        href: '/admin/convocatoria',
        label: 'Estado',
        icon: Flag,
        description: 'Si la convocatoria sigue abierta, y el botón para finalizarla cuando se cierra la recepción de obras.',
      },
      {
        href: '/admin/jurado',
        label: 'Jurado',
        icon: Gavel,
        description: 'Jurados, su avance y el ranking de las obras preseleccionadas hasta las 30 finalistas.',
      },
      {
        href: '/admin/pagos',
        label: 'Pagos',
        icon: CreditCard,
        description: 'Pagos de quienes postularon más de una obra.',
      },
    ],
  },
  {
    label: 'Tienda',
    icon: ShoppingBag,
    tone: tones.yellow,
    items: [
      {
        href: '/admin/tienda',
        label: 'Club y envíos',
        icon: Package,
        description: 'Suscriptores de Papel por correo, lo que hay que despachar y lo cobrado en el mes.',
      },
      {
        href: '/admin/revista',
        label: 'Revista',
        icon: BookOpen,
        description: 'Pedidos de la preventa de la revista impresa: a quién y adónde despacharla.',
      },
    ],
  },
  {
    label: 'Galería 3D',
    icon: Landmark,
    tone: tones.red,
    items: [
      {
        href: '/admin/comentarios',
        label: 'Comentarios',
        icon: MessageSquare,
        description:
          'Aprobá o rechazá lo que la gente comenta en el recorrido 3D.',
      },
      { href: '/galeria-3d', label: 'Recorrido', icon: Boxes, external: true },
    ],
  },
  {
    label: 'Newsletter',
    icon: Mail,
    tone: tones.ink,
    items: [
      {
        href: '/admin/contactos',
        label: 'Contactos',
        icon: Users,
        description:
          'La lista de suscriptores: pausalos, resuscribilos o borralos.',
      },
      {
        href: '/admin/campanas',
        label: 'Campañas',
        icon: Send,
        description:
          'Armá y mandá emails a tus contactos, y mirá cómo les fue.',
      },
      {
        href: '/admin/plantillas',
        label: 'Plantillas',
        icon: FileText,
        description:
          'Diseños de email para reusar en las campañas, traducidos a cada idioma.',
      },
      {
        href: '/admin/envios',
        label: 'Cupos de envío',
        icon: Gauge,
        description: 'Cuántos mails le quedan hoy y este mes a Resend y a Brevo, y por cuál sale cada tipo de envío.',
      },
    ],
  },
]

export function adminSectionFor(pathname: string | null) {
  return adminSections.find((s) =>
    s.items.some((item) => !item.external && pathname?.startsWith(item.href)),
  )
}

export function adminDescription(href: string) {
  return adminSections
    .flatMap((s) => s.items)
    .find((item) => item.href === href)?.description
}
