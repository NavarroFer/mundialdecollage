// Widths next/image may ask for (next.config.mjs) — and the only ones
// app/api/img resizes to, so nobody can fill the CDN with arbitrary sizes.
// Plain .mjs so next.config.mjs can import it too.
export const DEVICE_SIZES = [640, 828, 1080, 1200, 1920]
export const IMAGE_SIZES = [96, 128, 256, 384]
export const IMAGE_WIDTHS = [...IMAGE_SIZES, ...DEVICE_SIZES]
export const IMAGE_QUALITY = 75
