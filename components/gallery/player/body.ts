import type { RapierRigidBody } from '@react-three/rapier'

/** The visiting body, so a ramp can lift it without the walk controls knowing which building they're in. */
export const playerBody: { current: RapierRigidBody | null } = { current: null }
