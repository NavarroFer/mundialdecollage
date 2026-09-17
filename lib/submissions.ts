import { finalists } from '@/lib/finalists'

// Total count of collage works received for the Mundial, shown in the
// "Primera Edición" banner. There's no separate submissions dataset yet, so
// this mirrors the confirmed finalists — the only real data we have today.
// Once a real submissions pipeline exists, wire it up here (never hardcode
// a number in its place; ver ROADMAP.md, sección "Primera Edición").
export const submissionsCount = finalists.length
