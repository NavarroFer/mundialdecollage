/**
 * The two people behind the Mundial, for «Quiénes somos» (components/about-team.tsx).
 * Names and handles are the same in every language; the bullets live in
 * messages.about.team.
 *
 * Photos: drop a file in public/equipo/ and set `photo` to its public path
 * (e.g. '/equipo/fernando.jpg'). While it is null the card shows no photo and
 * stays complete.
 */
export type TeamMember = {
  id: 'fernando' | 'federico'
  name: string
  handle: string
  instagram: string
  photo: string | null
  /** object-position of the square photo: keeps the face in frame if the box ever crops. */
  photoPosition: string
  /** Which brand colour carries the name; the handle takes the other one. */
  accent: 'blue' | 'red'
}

export const team: TeamMember[] = [
  { id: 'fernando', name: 'Fernando Navarro', handle: '@fer.com.art', instagram: 'https://www.instagram.com/fer.com.art', photo: '/equipo/fernando.jpg', photoPosition: 'center 40%', accent: 'blue' },
  { id: 'federico', name: 'Federico Resumil', handle: '@tehacefaltacollage_', instagram: 'https://www.instagram.com/tehacefaltacollage_/', photo: '/equipo/federico.jpg', photoPosition: 'center 35%', accent: 'red' },
]
