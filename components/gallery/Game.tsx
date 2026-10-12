'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AttentionRecorder } from './attention/AttentionRecorder'
import { BookOpen, Menu, Smartphone, X } from 'lucide-react'
import type { Artwork } from '@/data/artworks'
import { GalleryPresence } from './presence/GalleryPresence'
import { TouchControls } from './mobile/TouchControls'
import { ArtworkModal } from './ui/ArtworkModal'
import { BackgroundMusic, type BackgroundMusicHandle } from './ui/BackgroundMusic'
import { Passport, PassportRecorder } from './ui/Passport'
import { usePassportStore } from './passport/store'
import { WalkNotice } from './navigation/WalkNotice'
import { ControlChoice } from './ui/ControlChoice'
import { ControlsTutorial } from './ui/ControlsTutorial'
import { InteractionPrompt } from './ui/InteractionPrompt'
import { Minimap } from './ui/Minimap'
import { PresenceCounter } from './ui/PresenceCounter'
import { Souvenir } from './ui/Souvenir'
import { StartScreen } from './ui/StartScreen'
import { VisitPreferences } from './ui/VisitPreferences'
import { useGalleryPreferences } from './preferences/store'
import { replayTutorial } from './tutorial/store'
import { useInteractionStore } from './interaction/store'
import { WallDialog } from './wall/WallDialog'
import { loadWall, useWallStore } from './wall/store'
import { useSouvenirStore } from './souvenir/store'
import { galleryThemes } from './themes'
import styles from './gallery-theme.module.css'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'
import { readGalleryReturn, readSharedArtwork, readWallReturn } from '@/lib/gallery-return'
import { readReferralParam, withReferral } from '@/lib/referral'
import { track } from '@/lib/track'

// Doesn't change over a session, so no subscription is needed — just a
// client-only snapshot read via useSyncExternalStore (SSR-safe, and no
// effect+setState render cascade the way a useEffect check would cause).
const noopSubscribe = () => () => {}
const getIsTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
const getServerSnapshot = () => false
const subscribeToOrientation = (callback: () => void) => {
  const query = window.matchMedia('(orientation: landscape)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const getIsLandscape = () => window.matchMedia('(orientation: landscape)').matches
// Render the game on the server; the orientation notice is a mobile-only
// client enhancement and should not replace the initial page markup.
const getLandscapeServerSnapshot = () => true

// three.js, drei and Rapier only arrive once the page has settled (or on
// ENTRAR, whichever comes first) and only mount on ENTRAR: see Scene.tsx.
const preloadScene = () => import('./Scene')
const Scene = dynamic(() => preloadScene().then((module) => module.Scene), { ssr: false })

// Chrome returns a promise here; Safari/Firefox return nothing and only fire pointerlockerror.
function requestLock(element: HTMLElement, onError: () => void) {
  Promise.resolve(element.requestPointerLock()).catch(onError)
}

export function Game({ artworks, userId }: { artworks: Artwork[]; userId: string }) {
  const isTouchDevice = useSyncExternalStore(noopSubscribe, getIsTouchDevice, getServerSnapshot)
  const isLandscape = useSyncExternalStore(subscribeToOrientation, getIsLandscape, getLandscapeServerSnapshot)
  const controlMode = useGalleryPreferences((state) => state.controlMode)
  // Walking by clicks or on a phone there's no Pointer Lock to say whether
  // the visitor is in the walk or on the pause screen, so this does.
  const [playing, setPlaying] = useState(false)
  const passportOpen = usePassportStore((state) => state.open)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const { locale, m } = useI18n()
  const [hasStarted, setHasStarted] = useState(false)
  const theme = useGalleryPreferences((state) => state.theme)
  useEffect(() => { useGalleryPreferences.getState().hydrate() }, [])
  const openId = useInteractionStore((state) => state.openId)
  useEffect(() => {
    if (openId && artworks.some((artwork) => artwork.id === openId)) useGalleryPreferences.getState().visit(openId)
  }, [openId, artworks])
  const souvenirOpen = useSouvenirStore((state) => state.open)
  const wallOpen = useWallStore((state) => state.placing !== null)
  const wallWeek = useWallStore((state) => state.weekStart)
  const musicRef = useRef<BackgroundMusicHandle>(null)
  // Desktop locks the pointer to the whole shell, not the canvas: the lock
  // has to be asked for in the ENTRAR click, before the canvas exists.
  const [shell, setShell] = useState<HTMLDivElement | null>(null)
  const [resuming, setResuming] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const loading = hasStarted && !sceneReady

  // With the keyboard on a computer, Pointer Lock IS the active state. Touch
  // and click-to-walk have no Pointer Lock, so ENTRAR is the activation and
  // Escape (or leaving the window) the pause.
  // A 3D game needs the horizontal viewport: touch play pauses in portrait
  // and resumes automatically as soon as the visitor turns the phone back.
  const usesPointerLock = !isTouchDevice && controlMode === 'classic'
  // Something in front of the walk: an obra, the photo, the collage, the passport.
  const dialogOpen = passportOpen || Boolean(openId) || souvenirOpen || wallOpen
  const overlayOpen = optionsOpen || dialogOpen
  const isActive = sceneReady && !overlayOpen && (!isTouchDevice || isLandscape) && (usesPointerLock ? locked : hasStarted && playing)
  // Under the start screen, the turn-the-phone notice or the phone menu
  // nothing needs to move, so the scene stops drawing frames and stepping
  // physics. Reading an obra, the collage or the souvenir keep it going:
  // the camera glides to the obra and the walls show around the dialog.
  const paused = !loading && ((isTouchDevice && !isLandscape) || (!isActive && !openId && !souvenirOpen && !wallOpen && !resuming))

  useEffect(() => {
    if (isTouchDevice || !shell) return
    const onChange = () => {
      const isLocked = document.pointerLockElement === shell
      setLocked(isLocked)
      if (isLocked) setResuming(false)
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [isTouchDevice, shell])

  // The page settled: fetch the scene now so ENTRAR rarely waits on it.
  useEffect(() => {
    const preload = () => void preloadScene()
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(preload, 2000)
    return () => clearTimeout(id)
  }, [])

  // Reading an obra shouldn't feel like pausing. The modal needs the cursor,
  // so opening it releases Pointer Lock; closing it with E, the × or a click
  // outside is a user gesture, which lets us take the lock straight back
  // before the pause screen can show. Escape isn't one the browser accepts
  // for that, so it still lands on "Click para continuar".
  useEffect(() => {
    if (!usesPointerLock || !shell) return
    let resumeOnClose = false
    const stopResuming = () => setResuming(false)
    document.addEventListener('pointerlockerror', stopResuming)
    // The collage's dialog (E on the big frame) works the same way.
    const isOpen = () => Boolean(useInteractionStore.getState().openId || useWallStore.getState().placing)
    let wasOpen = isOpen()
    const onChange = () => {
      const open = isOpen()
      if (open === wasOpen) return
      wasOpen = open
      if (open) {
        resumeOnClose = document.pointerLockElement !== null
        if (resumeOnClose) document.exitPointerLock()
        return
      }
      if (!resumeOnClose) return
      resumeOnClose = false
      if (navigator.userActivation?.isActive === false) return
      setResuming(true)
      requestLock(shell, stopResuming)
    }
    const unsubscribeInteraction = useInteractionStore.subscribe(onChange)
    const unsubscribeWall = useWallStore.subscribe(onChange)
    return () => {
      unsubscribeInteraction()
      unsubscribeWall()
      document.removeEventListener('pointerlockerror', stopResuming)
    }
  }, [usesPointerLock, shell])

  // Back from signing in with Google to like or comment: reopen that obra so
  // ArtworkLike / ArtworkComments can finish the action, and drop the
  // parameters so a reload doesn't repeat it. An obra no longer on the walls
  // (the day rotated meanwhile) is just skipped.
  useEffect(() => {
    track('gallery_view')
    void loadWall()
    // Back from signing in to paste on the collective collage: reopen its
    // dialog at the same spot of the frame.
    const wallReturn = readWallReturn(window.location.search)
    if (wallReturn) {
      window.history.replaceState(null, '', window.location.pathname)
      track('sign_in_return')
      useWallStore.getState().open(wallReturn)
      return
    }
    // A shared link to one obra (or the one in the museum mail): open it if
    // it's on the walls today, else show its own page — it's still an obra
    // of the Mundial, just not hanging right now.
    const shared = readSharedArtwork(window.location.search)
    if (shared) {
      track('shared_link_open')
      if (artworks.some((artwork) => artwork.id === shared)) {
        window.history.replaceState(null, '', window.location.pathname)
        useInteractionStore.getState().open(shared)
      } else {
        // Keeping ?ref so the obra's page still greets the artist's guest.
        const ref = readReferralParam(window.location.search)
        const path = `/obras/${encodeURIComponent(shared)}`
        window.location.replace(ref ? withReferral(path, ref) : path)
      }
      return
    }
    const pending = readGalleryReturn(window.location.search)
    if (!pending) return
    window.history.replaceState(null, '', window.location.pathname)
    track('sign_in_return')
    if (artworks.some((artwork) => artwork.id === pending.slug)) useInteractionStore.getState().resume(pending)
  }, [artworks])

  // Same as after reading an obra: the click that closes the photo is the
  // gesture the browser needs to give the mouse back to the walk.
  function resumeWalk() {
    setPlaying(true)
    if (!usesPointerLock || !shell) return
    setResuming(true)
    requestLock(shell, () => setResuming(false))
  }

  useEffect(() => {
    if (!optionsOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOptionsOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [optionsOpen])

  // Without Pointer Lock, Escape and leaving the window are the pause that
  // the browser gives the keyboard walk for free.
  useEffect(() => {
    if (usesPointerLock || !isActive) return
    const pause = (event: KeyboardEvent) => { if (event.key === 'Escape') setPlaying(false) }
    const leave = () => { if (!isTouchDevice) setPlaying(false) }
    window.addEventListener('keydown', pause)
    window.addEventListener('blur', leave)
    return () => {
      window.removeEventListener('keydown', pause)
      window.removeEventListener('blur', leave)
    }
  }, [usesPointerLock, isActive, isTouchDevice])

  // Shortcuts while walking: H shows the tutorial again, P opens the passport.
  useEffect(() => {
    if (!isActive || isTouchDevice) return
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const element = document.activeElement
      if (element instanceof HTMLElement && (element.matches('input, textarea, select') || element.isContentEditable)) return
      if (event.code === 'KeyH') replayTutorial()
      if (event.code === 'KeyP') openPassport()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, isTouchDevice])

  function handleEnter(lockPointer = true) {
    if (!hasStarted) track('gallery_enter')
    setHasStarted(true)
    setPlaying(true)
    setOptionsOpen(false)
    // Right here, in the click: the browser only grants the lock to a user
    // gesture, and the scene may take a few seconds more to load.
    if (lockPointer && usesPointerLock && shell) requestLock(shell, () => {})
    musicRef.current?.play()
  }

  // The walk's buttons need the mouse back from Pointer Lock first.
  function toggleOptions() {
    if (document.pointerLockElement) document.exitPointerLock()
    setOptionsOpen((open) => !open)
  }

  function openPassport() {
    if (document.pointerLockElement) document.exitPointerLock()
    setOptionsOpen(false)
    usePassportStore.getState().setOpen(true)
  }

  function resumeArtwork(id: string) {
    useGalleryPreferences.setState({ resumeArtwork: id })
    setOptionsOpen(false)
    handleEnter(false)
    useInteractionStore.getState().open(id)
  }

  return (
    <div ref={setShell} className={cn(styles.shell, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden)}>
      {/* The canvas's size and color before it loads, so nothing shifts when it does. */}
      <div style={{ height: '100dvh', background: galleryThemes[theme].canvas }}>
        {hasStarted && (
          <Scene
            artworks={artworks}
            theme={theme}
            active={isActive}
            controlMode={controlMode}
            paused={paused}
            isTouchDevice={isTouchDevice}
            lockTarget={isTouchDevice ? null : shell}
            wall={{
              title: m.gallery.wall.plaque,
              subtitle: wallWeek ? fmt(m.gallery.wall.week, { date: formatDayMonth(locale, `${wallWeek}T12:00:00-03:00`) }) : '',
              cyrillic: locale === 'ru',
            }}
            onReady={() => setSceneReady(true)}
          />
        )}
      </div>
      <AttentionRecorder userId={userId} artworks={artworks} walking={isActive} enabled={!passportOpen && !souvenirOpen && !wallOpen && !optionsOpen && (!isTouchDevice || isLandscape) && (isActive || Boolean(openId))} />
      <PassportRecorder userId={userId} started={hasStarted} />
      <GalleryPresence inside={isTouchDevice ? hasStarted && isLandscape : isActive} artworks={artworks} />
      {isTouchDevice && isActive && <TouchControls theme={theme} />}
      {/* The visit's own buttons, on the pause screen too: on a computer at
          the bottom, out of the minimap's way; on a phone at the top, out of
          the joysticks' way. Hidden, not unmounted, under a dialog: the photo
          button's own dialog lives in here. */}
      <nav className={styles.visitToolbar} aria-label={m.gallery.controls.toolbar} hidden={!sceneReady || (isTouchDevice && !isLandscape) || dialogOpen}>
        <button type="button" className={styles.hudButton} onClick={toggleOptions} aria-expanded={optionsOpen} aria-controls="gallery-options">
          {optionsOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          <span className={styles.visitToolbarLabel}>{m.gallery.mobileMenu.open}</span>
        </button>
        <button type="button" className={styles.hudButton} onClick={openPassport} aria-label={m.gallery.passport.button} title={isTouchDevice ? undefined : `${m.gallery.passport.button} (P)`}>
          <BookOpen size={18} aria-hidden="true" />
          <span className={styles.visitToolbarLabel}>{m.gallery.passport.button}</span>
        </button>
        {!isTouchDevice && hasStarted && <Souvenir theme={theme} isTouchDevice={false} active={isActive} onResume={resumeWalk} />}
      </nav>
      <BackgroundMusic ref={musicRef} theme={theme} inline={isTouchDevice} />
      {/* On a computer the minimap stays on screen; a phone keeps it (and
          the photo button) in Opciones, so the walk has the whole screen. */}
      {!isTouchDevice && <Minimap theme={theme} artworks={artworks} />}
      {!isTouchDevice && hasStarted && <PresenceCounter />}
      <div id="gallery-options" className={styles.visitMenu} hidden={!optionsOpen || !hasStarted || (isTouchDevice && !isLandscape) || dialogOpen}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{m.gallery.mobileMenu.open}</h2>
          <button type="button" className="flex min-h-11 min-w-11 items-center justify-center" onClick={() => setOptionsOpen(false)} aria-label={m.gallery.mobileMenu.close}><X size={20} aria-hidden="true" /></button>
        </div>
        <ControlChoice touch={isTouchDevice} />
        {isTouchDevice && hasStarted && <Souvenir theme={theme} isTouchDevice active={false} onResume={resumeWalk} inline />}
        {isTouchDevice && <Minimap theme={theme} artworks={artworks} />}
        {isTouchDevice && hasStarted && <PresenceCounter />}
        <VisitPreferences artworks={artworks} onResume={resumeArtwork} />
        <button type="button" className={styles.visitMenuButton} onClick={() => { replayTutorial(); handleEnter() }}>{m.gallery.tutorial.replay}</button>
        <button type="button" className={styles.visitMenuButton} onClick={() => handleEnter()}>{m.gallery.mobileMenu.resume}</button>
      </div>
      <ControlsTutorial active={isActive} isTouchDevice={isTouchDevice} />
      {isActive && !isTouchDevice && <InteractionPrompt theme={theme} pointMode={controlMode === 'point'} />}
      {isActive && <WalkNotice />}
      <Passport artworks={artworks} theme={theme} onClose={resumeWalk} onResume={resumeArtwork} />
      <ArtworkModal artworks={artworks} theme={theme} />
      <WallDialog theme={theme} />
      {isTouchDevice && !isLandscape && (
        <section className={styles.orientationPrompt} aria-labelledby="gallery-orientation-title">
          <div className={styles.orientationPhoneStage} aria-hidden="true">
            <Smartphone className={styles.orientationPhone} strokeWidth={1.5} />
          </div>
          <div aria-live="polite">
            <h2 id="gallery-orientation-title">{m.gallery.orientation.title}</h2>
            <p>{m.gallery.orientation.body}</p>
            <p className={styles.orientationHint}>{m.gallery.orientation.rotationHint}</p>
          </div>
          <Link href="/" className={styles.orientationExit}>{m.gallery.orientation.back}</Link>
        </section>
      )}
      {!isActive && !overlayOpen && !resuming && (
        <StartScreen
          artworks={artworks}
          touch={isTouchDevice}
          label={loading ? m.gallery.loading : hasStarted ? m.gallery.resume : m.gallery.enter}
          loading={loading}
          showPresence={!hasStarted}
          hint={controlMode === 'point' ? (isTouchDevice ? m.gallery.controls.hintTap : m.gallery.controls.hintClick) : isTouchDevice ? m.gallery.hintTouch : m.gallery.hintDesktop}
          onEnter={() => handleEnter()}
          onResume={resumeArtwork}
        />
      )}
    </div>
  )
}
