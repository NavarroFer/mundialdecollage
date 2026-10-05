// SplashScreen (components/splash-screen.tsx) marks its cover with
// data-splash, and adds data-leaving shortly before it's gone, so client code
// can tell when the home's intro is ending.

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
