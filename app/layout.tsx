import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Anton, Oswald } from 'next/font/google'
import './globals.css'
import { site, getSiteUrl } from '@/lib/site'
import { ClarityAnalytics } from '@/components/clarity'
import { getI18n } from '@/lib/i18n/server'
import { I18nProvider } from '@/lib/i18n/client'
import { pickClientMessages } from '@/lib/i18n/messages/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'
import { LOCALE_INFO } from '@/lib/i18n/locales'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' })
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
})
// Anton has no Cyrillic, so Russian headings fall back to this condensed face.
// Not preloaded: browsers only fetch it when Cyrillic text actually shows up.
const oswald = Oswald({
  subsets: ['cyrillic'],
  weight: '700',
  variable: '--font-display-cyrillic',
  display: 'swap',
  preload: false,
})

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await getI18n()
  const date = formatDayMonth(locale, site.deadlineISO)
  return {
    metadataBase: new URL(getSiteUrl()),
    title: m.meta.title,
    description: fmt(m.meta.description, { date }),
    openGraph: {
      title: m.meta.title,
      description: fmt(m.meta.ogDescription, { date }),
      siteName: site.name,
      locale: LOCALE_INFO[locale].og,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.meta.title,
      description: fmt(m.meta.twitterDescription, { date }),
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { locale, m } = await getI18n()
  return (
    <html lang={locale} className={`${geist.variable} ${anton.variable} ${oswald.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <I18nProvider locale={locale} messages={pickClientMessages(m)}>
          {children}
        </I18nProvider>
        <ClarityAnalytics />
      </body>
    </html>
  )
}
