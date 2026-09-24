'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Locale } from './locales'
import type { ClientMessages } from './messages/client'

const I18nContext = createContext<{ locale: Locale; m: ClientMessages } | null>(null)

// The root layout hands client components only the namespaces they use
// (see pickClientMessages), not the whole dictionary.
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: ClientMessages; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, m: messages }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
