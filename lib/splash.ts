// SplashScreen (components/splash-screen.tsx) marks its cover with
// data-splash, so client code can tell when the home's intro is done.

// Calls `callback` once the splash has left the page — right away when there
// isn't one. The cover is in the server HTML, so this works before the splash
// itself hydrates. Returns a cleanup that cancels the wait.
export function afterSplash(callback: () => void): () => void {
  const covered = () => document.querySelector('[data-splash]') !== null
  if (!covered()) {
    callback()
    return () => {}
  }
  const observer = new MutationObserver(() => {
    if (covered()) return
    observer.disconnect()
    callback()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
