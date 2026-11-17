'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

// A short confirmation at the bottom of the screen («Ahora ves el sitio como
// admin»), for an action whose result isn't obvious where the person looks.
// Any client component calls showNotice(); the one host in the root layout
// draws it, so it survives the page re-rendering or the component that asked
// for it unmounting (a menu that closes, a header that changes).

const EVENT = 'site-notice'
const VISIBLE_MS = 2800

export function showNotice(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }))
}

export function SiteNoticeHost() {
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onNotice = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      if (!message) return
      window.clearTimeout(timer.current)
      setNotice({ id: Date.now(), message })
      timer.current = window.setTimeout(() => setNotice(null), VISIBLE_MS)
    }
    window.addEventListener(EVENT, onNotice)
    return () => {
      window.removeEventListener(EVENT, onNotice)
      window.clearTimeout(timer.current)
    }
  }, [])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[2147483646] flex justify-center px-4 lg:bottom-8">
      {notice && (
        <p
          key={notice.id}
          className="inline-flex max-w-full items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
        >
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice.message}
        </p>
      )}
    </div>
  )
}
