/** Hardware hints choose a starting point, never claim to benchmark a GPU. */
export const LEVELS = ['low', 'medium', 'high', 'ultra'] as const
export type Quality = typeof LEVELS[number]
export type Selection = Quality | 'auto'
export const PRESETS = {
  low: { dpr: 0.85, shadows: 0, detail: false, anisotropy: 1, visitors: 2 },
  medium: { dpr: 1.15, shadows: 1024, detail: false, anisotropy: 2, visitors: 3 },
  high: { dpr: 1.5, shadows: 2048, detail: true, anisotropy: 4, visitors: 5 },
  ultra: { dpr: 2, shadows: 4096, detail: true, anisotropy: 8, visitors: 5 },
} as const
export type Capabilities = { mobile: boolean; cores?: number; memory?: number; maxTextureSize?: number }
export function initialQuality({ mobile, cores, memory, maxTextureSize }: Capabilities): Quality {
  if ((cores !== undefined && cores <= 2) || (memory !== undefined && memory <= 2) || (maxTextureSize !== undefined && maxTextureSize < 4096)) return 'low'
  if (mobile || (cores !== undefined && cores <= 4) || (memory !== undefined && memory <= 4)) return 'medium'
  // Missing hints (e.g. Safari) get a conservative start; measured FPS can raise it.
  return cores === undefined ? 'medium' : 'high'
}
export function boundedDpr(quality: Quality, width: number, height: number, nativeDpr: number, mobile: boolean) {
  const pixelBudget = mobile ? 2_000_000 : 8_000_000
  return Math.min(PRESETS[quality].dpr, Math.max(0.5, nativeDpr), Math.sqrt(pixelBudget / Math.max(1, width * height)))
}
export function parseGraphics(raw: string | null): { selection: Selection; adaptive: boolean } {
  try {
    const value = JSON.parse(raw ?? '{}')
    return { selection: LEVELS.includes(value?.selection) ? value.selection : 'auto', adaptive: value?.adaptive !== false }
  } catch { return { selection: 'auto', adaptive: true } }
}

/** Real frame times, 3s windows, asymmetric hysteresis and cooldown. No per-frame React updates. */
export class FrameGovernor {
  private elapsed = 0
  private frames = 0
  private slow = 0
  private fast = 0
  private warmup = 5
  reset() { this.elapsed = this.frames = this.slow = this.fast = 0; this.warmup = 5 }
  sample(delta: number, quality: Quality, ceiling: Quality): { fps: number; next: Quality } | null {
    if (!Number.isFinite(delta) || delta <= 0 || delta > 0.5) { this.reset(); return null }
    if (this.warmup > 0) { this.warmup -= delta; return null }
    this.elapsed += delta
    this.frames++
    if (this.elapsed < 3) return null
    const fps = this.frames / this.elapsed
    this.elapsed = this.frames = 0
    this.slow = fps < 42 ? this.slow + 1 : 0
    this.fast = fps > 57 ? this.fast + 1 : 0
    const index = LEVELS.indexOf(quality)
    let next = quality
    if (this.slow >= 2 && index > 0) next = LEVELS[index - 1]
    // 30s sustained headroom to upgrade vs 6s to protect responsiveness.
    else if (this.fast >= 10 && index < LEVELS.indexOf(ceiling)) next = LEVELS[index + 1]
    if (next !== quality) { this.reset(); this.warmup = 12 }
    return { fps: Math.round(fps), next }
  }
}
