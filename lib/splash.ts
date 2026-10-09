// SplashScreen (components/splash-screen.tsx) marks its cover with
// data-splash, and adds data-leaving shortly before it's gone, so client code
// can tell when the home's intro is ending.

// The intro plays once per browser: reloading or coming back goes straight to
// the page. Written when the cover finishes leaving, so a reload mid-intro
// plays it again.
export const SPLASH_SEEN_KEY = 'mdc-splash-seen'

// The cover is in the home's server HTML for everyone (the home is built ahead
// and served from the CDN), so a returning visitor would see it until React
// hydrates and drops it. app/[locale]/layout.tsx runs this in <head>, before
// the body paints, to hide it first.
export const HIDE_SEEN_SPLASH_SCRIPT = `try{if(localStorage.getItem('${SPLASH_SEEN_KEY}'))document.head.appendChild(document.createElement('style')).textContent='[data-splash]{display:none}'}catch(e){}`

export function splashSeen(): boolean {
  try {
    return window.localStorage.getItem(SPLASH_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markSplashSeen() {
  try {
    window.localStorage.setItem(SPLASH_SEEN_KEY, '1')
  } catch {}
}

// Calls `callback` once the splash starts leaving the page — right away when
// there isn't one. The cover is in the server HTML, so this works before the splash
// itself hydrates. Returns a cleanup that cancels the wait.
export function afterSplash(callback: () => void): () => void {
  const covered = () => document.querySelector('[data-splash]:not([data-leaving])') !== null
  if (!covered()) {
    callback()
    return () => {}
  }
  const observer = new MutationObserver(() => {
    if (covered()) return
    observer.disconnect()
    callback()
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-leaving'] })
  return () => observer.disconnect()
}
