// The camera's vertical field of view on a computer or a phone held sideways.
export const BASE_FOV = 70
// Held upright, 70° from floor to ceiling leaves a phone a slit about 36°
// across, so the view opens up until at least this much fits side to side.
export const MIN_HORIZONTAL_FOV = 50

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

/** Vertical field of view, in degrees, for a viewport `aspect` (width / height) wide. */
export function verticalFov(aspect: number) {
  if (!(aspect > 0)) return BASE_FOV
  const fitsMinimumWidth = toDegrees(2 * Math.atan(Math.tan(toRadians(MIN_HORIZONTAL_FOV / 2)) / aspect))
  return Math.max(BASE_FOV, fitsMinimumWidth)
}

/** Horizontal field of view, in degrees, of a `fov` vertical one on a viewport `aspect` wide. */
export function horizontalFov(fov: number, aspect: number) {
  return toDegrees(2 * Math.atan(Math.tan(toRadians(fov / 2)) * aspect))
}
