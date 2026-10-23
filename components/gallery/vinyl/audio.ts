export type VolumeRoute = { context: AudioContext; gain: GainNode }
export const gainFor = (volume: number) => (Math.max(0, Math.min(100, volume)) / 100) ** 2

/** Use Web Audio on every supported browser: mobile volume property writes
 * can succeed without actually changing the audible output. Create on a gesture. */
export function routeThroughGain(audio: HTMLAudioElement): VolumeRoute | null {
  try {
    const context = new AudioContext()
    const gain = context.createGain()
    context.createMediaElementSource(audio).connect(gain).connect(context.destination)
    return { context, gain }
  } catch {
    return null
  }
}

/** Never attenuate twice. Apply mute synchronously before play(), including
 * when selecting a song while React still has a muted render on screen. */
export function applyAudioVolume(audio: HTMLAudioElement, route: VolumeRoute | null, volume: number, muted: boolean) {
  audio.muted = muted
  audio.volume = route ? 1 : gainFor(volume)
  if (route) route.gain.gain.setTargetAtTime(muted ? 0 : gainFor(volume), route.context.currentTime, 0.02)
}
