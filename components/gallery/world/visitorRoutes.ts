// The scripted visitors' loops through the rooms in roomsData: each walks
// from stop to stop (and back to the first), pausing to look at the obras.
// visitorRoutes.test.ts keeps every leg clear of the walls, so a layout
// change that puts a panel in someone's way fails there.

export type Stop = {
  position: [number, number]
  wait?: number
  /** The way to look while waiting: 0 faces south (+z), Math.PI north. */
  face?: number
}

export type VisitorDefinition = {
  id: string
  color: string
  speed: number
  offset: number
  route: Stop[]
}

const NORTH = Math.PI
const SOUTH = 0
const EAST = Math.PI / 2
const WEST = -Math.PI / 2

export const VISITORS: VisitorDefinition[] = [
  {
    // Room 1: its long walls, its panel and the collective collage.
    id: 'visitor-01', color: '#5e3b2a', speed: 0.62, offset: 0,
    route: [
      { position: [-14.8, -3], wait: 3.5, face: NORTH },
      { position: [-10.9, -3], wait: 4, face: NORTH },
      { position: [-13.6, 1.5], wait: 3, face: EAST },
      { position: [-14.8, 3], wait: 4, face: SOUTH },
      { position: [-15.5, 0], wait: 4, face: WEST },
    ],
  },
  {
    // The hall, around its panel and through the corridor behind it.
    id: 'visitor-02', color: '#7b2d3b', speed: 0.54, offset: 2,
    route: [
      { position: [-4.8, -3], wait: 3, face: NORTH },
      { position: [2.9, -3], wait: 4.5, face: NORTH },
      { position: [3.4, 0.4] },
      { position: [1.5, 3], wait: 3.5, face: SOUTH },
      { position: [-1, 3.95], wait: 4, face: NORTH },
      { position: [-3.7, 3], wait: 3, face: SOUTH },
      { position: [-5.2, 0.6] },
    ],
  },
  {
    // Room 3, zigzagging through its three bays and back along the south.
    id: 'visitor-03', color: '#c99a3a', speed: 0.58, offset: 4,
    route: [
      { position: [8.2, -3], wait: 4, face: NORTH },
      { position: [8.3, 0.75], wait: 3.5, face: EAST },
      { position: [8.6, 4] },
      { position: [11.2, 4] },
      { position: [12.5, 3], wait: 3.5, face: SOUTH },
      { position: [12.6, 0.75], wait: 3, face: WEST },
      { position: [12.5, -0.75], wait: 3, face: EAST },
      { position: [12.5, -3.95] },
      { position: [16.2, -3.95] },
      { position: [16.6, -0.75], wait: 3.5, face: WEST },
      { position: [15.9, 0.2], wait: 4, face: EAST },
      { position: [14.5, 3.6] },
      { position: [10.5, 4.1] },
      { position: [8.2, 2.2] },
    ],
  },
  {
    // A walk through the whole gallery, both doorways, and back.
    id: 'visitor-04', color: '#8fb3d9', speed: 0.7, offset: 1,
    route: [
      { position: [-15, -1.2], wait: 2 },
      { position: [-9.6, -2.4] },
      { position: [-6.4, -2.4] },
      { position: [0, -2.9], wait: 3, face: NORTH },
      { position: [4.4, 2.4] },
      { position: [7.6, 2.4] },
      { position: [8.4, 1], wait: 2.5, face: EAST },
      { position: [7.6, 2.4] },
      { position: [4.4, 2.4] },
      { position: [1.4, 3.1], wait: 3, face: SOUTH },
      { position: [-5.4, 2.4] },
      { position: [-6.4, -2.4] },
      { position: [-9.6, -2.4] },
    ],
  },
  {
    // Between Room 1's cabinet and the hall's panel.
    id: 'visitor-05', color: '#6b7c4b', speed: 0.48, offset: 3,
    route: [
      { position: [-9.4, 1.5], wait: 3.5, face: WEST },
      { position: [-9.6, -2.4] },
      { position: [-6.4, -2.4] },
      { position: [-1.6, -0.3], wait: 4, face: SOUTH },
      { position: [-6.4, -2.4] },
      { position: [-9.6, -2.4] },
    ],
  },
]
