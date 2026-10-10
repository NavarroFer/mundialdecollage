import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Anton, Oswald } from 'next/font/google'
import '../globals.css'
import { site, getSiteUrl } from '@/lib/site'
import { ClarityAnalytics } from '@/components/clarity'
import { VercelAnalytics } from '@/components/vercel-analytics'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ReferralCapture } from '@/components/referral-capture'
import { getI18n } from '@/lib/i18n/server'
import { I18nProvider } from '@/lib/i18n/client'
import { getCallState } from '@/lib/call-state'
import { pickClientMessages } from '@/lib/i18n/messages/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'
import { LOCALE_INFO, LOCALES } from '@/lib/i18n/locales'
import { HIDE_SEEN_SPLASH_SCRIPT } from '@/lib/splash'

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

// Every page lives under /<locale>/ (proxy.ts rewrites to it, the address
// bar never shows it), so the ones that read nothing else are built for
// each language and served from the CDN.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const [{ locale, m }, { open }] = await Promise.all([getI18n(), getCallState()])
  const date = formatDayMonth(locale, site.deadlineISO)
  // Once the call closes, previews stop inviting to «send your obra by …».
  const description = (template: string) => (open ? fmt(template, { date }) : m.closed.intro)
  return {
    metadataBase: new URL(getSiteUrl()),
    title: m.meta.title,
    description: description(m.meta.description),
    openGraph: {
      title: m.meta.title,
      description: description(m.meta.ogDescription),
      siteName: site.name,
      locale: LOCALE_INFO[locale].og,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.meta.title,
      description: description(m.meta.twitterDescription),
    },
  }
}

// The locale is the one proxy.ts rewrote to; getI18n() falls back to the
// request if the segment holds anything else.
export default async function RootLayout({ children }: LayoutProps<'/[locale]'>) {
  const { locale, m } = await getI18n()
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${geist.variable} ${anton.variable} ${oswald.variable}`}>
      <head>
        {/* Blocking on purpose: it has to run before the home's splash paints. */}
        <script dangerouslySetInnerHTML={{ __html: HIDE_SEEN_SPLASH_SCRIPT }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ReferralCapture />
        <I18nProvider locale={locale} messages={pickClientMessages(m)}>
          {children}
        </I18nProvider>
        <ClarityAnalytics />
        <VercelAnalytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
