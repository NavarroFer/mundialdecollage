import { create } from 'zustand'

/** Each "see the tutorial again" (H, or the button in Opciones) starts it over. */
export const useTutorialStore = create<{ replays: number }>(() => ({ replays: 0 }))

export function replayTutorial() {
  useTutorialStore.setState((state) => ({ replays: state.replays + 1 }))
}
