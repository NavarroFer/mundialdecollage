import { describe, expect, it } from 'vitest'
import { GALLERY_BOUNDS, walls } from './roomsData'
import { VISITORS } from './visitorRoutes'

// A person's shoulders, so nobody brushes through a wall's edge.
const BODY = 0.3
const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS

const clear = (x: number, z: number) =>
  x > minX + BODY && x < maxX - BODY && z > minZ + BODY && z < maxZ - BODY &&
  !walls.some(({ position, size }) => Math.abs(x - position[0]) < size[0] / 2 + BODY && Math.abs(z - position[2]) < size[2] / 2 + BODY)

describe('VISITORS', () => {
  it('walks every leg of every loop without going through a wall', () => {
    for (const { id, route } of VISITORS) {
      route.forEach(({ position: [ax, az] }, index) => {
        const [bx, bz] = route[(index + 1) % route.length].position
        const length = Math.hypot(bx - ax, bz - az)
        for (let along = 0; along <= length; along += 0.05) {
          const x = ax + ((bx - ax) * along) / length
          const z = az + ((bz - az) * along) / length
          expect(clear(x, z), `${id} leg ${index} at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(true)
        }
      })
    }
  })
})
