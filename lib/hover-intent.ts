// When a hover card opens and closes, with no DOM in it so it can be tested
// with fake timers. It opens after the pointer rests (not on every pass over
// the card), closes a moment after it leaves (so it can cross the gap to the
// card), and keyboard focus opens it at once.
export type HoverIntent = {
  /** The pointer came over the trigger or the card. */
  enter(): void
  /** The pointer left both, or focus moved out of them. */
  leave(): void
  /** Keyboard focus reached the trigger or the card. */
  focus(): void
  /** Escape: close now. */
  escape(): void
  dispose(): void
}

export function createHoverIntent(options: {
  onOpen: () => void
  onClose: () => void
  openDelay?: number
  closeDelay?: number
}): HoverIntent {
  const { onOpen, onClose, openDelay = 250, closeDelay = 150 } = options
  let open = false
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    openTimer = closeTimer = undefined
  }
  function show() {
    if (open) return
    open = true
    onOpen()
  }
  function hide() {
    if (!open) return
    open = false
    onClose()
  }

  return {
    enter() {
      clearTimeout(closeTimer)
      closeTimer = undefined
      if (open || openTimer) return
      openTimer = setTimeout(() => { openTimer = undefined; show() }, openDelay)
    },
    leave() {
      clearTimeout(openTimer)
      openTimer = undefined
      if (!open || closeTimer) return
      closeTimer = setTimeout(() => { closeTimer = undefined; hide() }, closeDelay)
    },
    focus() {
      clear()
      show()
    },
    escape() {
      clear()
      hide()
    },
    dispose: clear,
  }
}

/**
 * A real mouse: the event came from one and the device can hover. A tap on a
 * phone also fires pointer-enter events, and must only follow the link.
 */
export function isRealMouse(pointerType: string, matchMedia: ((query: string) => { matches: boolean }) | undefined): boolean {
  return pointerType === 'mouse' && Boolean(matchMedia?.('(hover: hover) and (pointer: fine)').matches)
}
