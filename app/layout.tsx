import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Anton } from 'next/font/google'
import './globals.css'
import { site, getSiteUrl } from '@/lib/site'
import { ClarityAnalytics } from '@/components/clarity'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' })
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: `${site.name} — Convocatoria abierta`,
  description:
    'Convocatoria abierta al Mundial Internacional de Collage. Enviá tu obra original hasta el 15 de noviembre. Jurado internacional, Gran Muestra Online y Revista 1ª Edición de Collage.',
  openGraph: {
    title: `${site.name} — Convocatoria abierta`,
    description:
      'El Mundial ya está sucediendo y queremos que tu obra sea parte. Enviá tu collage original hasta el 15 de noviembre.',
    siteName: site.name,
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — Convocatoria abierta`,
    description: 'Enviá tu collage original hasta el 15 de noviembre.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geist.variable} ${anton.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
        <ClarityAnalytics />
      </body>
    </html>
  )
}
