'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Smartphone } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { FloatingReactions } from './artwork/FloatingReactions'
import { FirstPersonCamera, type FirstPersonCameraHandle } from './camera/FirstPersonCamera'
import { InteractionManager } from './interaction/InteractionManager'
import { PlayerTracker } from './minimap/PlayerTracker'
import { GalleryPresence } from './presence/GalleryPresence'
import { TouchControls } from './mobile/TouchControls'
import { TouchLookController } from './mobile/TouchLookController'
import { Player } from './player/Player'
import { keyboardMap } from './player/controls'
import { ArtworkModal } from './ui/ArtworkModal'
import { BackgroundMusic, type BackgroundMusicHandle } from './ui/BackgroundMusic'
import { ControlsTutorial } from './ui/ControlsTutorial'
import { InteractionPrompt } from './ui/InteractionPrompt'
import { Minimap } from './ui/Minimap'
import { PresenceCounter } from './ui/PresenceCounter'
import { Souvenir } from './ui/Souvenir'
import { StartScreen } from './ui/StartScreen'
import { ThemePicker } from './ui/ThemePicker'
import { useInteractionStore } from './interaction/store'
import { SouvenirCapture } from './souvenir/SouvenirCapture'
import { CollageWall, WallAim } from './wall/CollageWall'
import { WallDialog } from './wall/WallDialog'
import { loadWall, useWallStore } from './wall/store'
import { useSouvenirStore } from './souvenir/store'
import { World } from './world/World'
import { galleryThemes, type GalleryTheme } from './themes'
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

export function Game({ artworks }: { artworks: Artwork[] }) {
  const isTouchDevice = useSyncExternalStore(noopSubscribe, getIsTouchDevice, getServerSnapshot)
  const isLandscape = useSyncExternalStore(subscribeToOrientation, getIsLandscape, getLandscapeServerSnapshot)
  const [locked, setLocked] = useState(false)
  const { locale, m } = useI18n()
  const [hasStarted, setHasStarted] = useState(false)
  const [theme, setTheme] = useState<GalleryTheme>('collage')
  const openId = useInteractionStore((state) => state.openId)
  const souvenirOpen = useSouvenirStore((state) => state.open)
  const wallOpen = useWallStore((state) => state.placing !== null)
  const wallWeek = useWallStore((state) => state.weekStart)
  const musicRef = useRef<BackgroundMusicHandle>(null)
  const controlsRef = useRef<FirstPersonCameraHandle>(null)
  const [resuming, setResuming] = useState(false)

  // Desktop has no concept of "started but not locked" — Pointer Lock IS
  // the active state. Touch has no Pointer Lock at all, so tapping ENTRAR
  // is the whole activation.
  // A 3D game needs the horizontal viewport: touch play pauses in portrait
  // and resumes automatically as soon as the visitor turns the phone back.
  const isActive = isTouchDevice ? hasStarted && isLandscape : locked

  // Reading an obra shouldn't feel like pausing. The modal needs the cursor,
  // so opening it releases Pointer Lock; closing it with E, the × or a click
  // outside is a user gesture, which lets us take the lock straight back
  // before the pause screen can show. Escape isn't one the browser accepts
  // for that, so it still lands on "Click para continuar".
  useEffect(() => {
    if (isTouchDevice) return
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
      const element = controlsRef.current?.domElement
      if (!element || navigator.userActivation?.isActive === false) return
      setResuming(true)
      // Chrome returns a promise here; Safari/Firefox return nothing and only fire pointerlockerror.
      Promise.resolve(element.requestPointerLock()).catch(stopResuming)
    }
    const unsubscribeInteraction = useInteractionStore.subscribe(onChange)
    const unsubscribeWall = useWallStore.subscribe(onChange)
    return () => {
      unsubscribeInteraction()
      unsubscribeWall()
      document.removeEventListener('pointerlockerror', stopResuming)
    }
  }, [isTouchDevice])

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
    const element = controlsRef.current?.domElement
    if (!element) return
    setResuming(true)
    Promise.resolve(element.requestPointerLock()).catch(() => setResuming(false))
  }

  function handleEnter() {
    if (!hasStarted) track('gallery_enter')
    setHasStarted(true)
    musicRef.current?.play()
  }

  return (
    <div className={cn(styles.shell, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden)}>
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows="variance"
          // R3F's Canvas hardcodes the container div to width/height 100% and
          // merges any `style` prop on top — a `className` can't win against
          // that inline style, so the viewport-relative height has to go here.
          style={{ width: '100%', height: '100dvh', background: galleryThemes[theme].canvas }}
        >
          <Physics>
            <World artworks={artworks} theme={theme} />
            <Player active={isActive} artworks={artworks} />
          </Physics>
          {!isTouchDevice && (
            <FirstPersonCamera
              ref={controlsRef}
              selector="#gallery-enter-button"
              pointerSpeed={0.75}
              onLock={() => {
                setLocked(true)
                setResuming(false)
              }}
              onUnlock={() => setLocked(false)}
            />
          )}
          <TouchLookController active={isActive} />
          <InteractionManager artworks={artworks} />
          <PlayerTracker />
          <FloatingReactions artworks={artworks} />
          <SouvenirCapture />
          <WallAim />
          <CollageWall
            theme={theme}
            title={m.gallery.wall.plaque}
            subtitle={wallWeek ? fmt(m.gallery.wall.week, { date: formatDayMonth(locale, `${wallWeek}T12:00:00-03:00`) }) : ''}
            cyrillic={locale === 'ru'}
          />
        </Canvas>
      </KeyboardControls>
      <GalleryPresence inside={isActive} artworks={artworks} />
      {isTouchDevice && isActive && !openId && !souvenirOpen && !wallOpen && <TouchControls theme={theme} />}
      <BackgroundMusic ref={musicRef} theme={theme} />
      {hasStarted && <Souvenir theme={theme} isTouchDevice={isTouchDevice} onResume={resumeWalk} />}
      <Minimap theme={theme} artworks={artworks} />
      {hasStarted && <PresenceCounter />}
      <ControlsTutorial active={isActive} isTouchDevice={isTouchDevice} />
      <InteractionPrompt theme={theme} />
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
      {!openId && !souvenirOpen && !wallOpen && <ThemePicker theme={theme} onChange={setTheme} />}
      {!isActive && !openId && !souvenirOpen && !wallOpen && !resuming && (
        <StartScreen
          artworks={artworks}
          label={hasStarted ? m.gallery.resume : m.gallery.enter}
          showPresence={!hasStarted}
          hint={isTouchDevice ? m.gallery.hintTouch : m.gallery.hintDesktop}
          onEnter={handleEnter}
        />
      )}
    </div>
  )
}
