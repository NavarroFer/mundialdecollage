import type { Messages } from './es'

const CLIENT_NAMESPACES = [
  'common',
  'language',
  'auth',
  'splash',
  'countdown',
  'hero',
  'collage',
  'map',
  'participantsPage',
  'search',
  'countrySelect',
  'onboarding',
  'confirmation',
  'entries',
  'gallery',
] as const

export type ClientMessages = Pick<Messages, (typeof CLIENT_NAMESPACES)[number]>

export function pickClientMessages(messages: Messages): ClientMessages {
  return Object.fromEntries(CLIENT_NAMESPACES.map((key) => [key, messages[key]])) as ClientMessages
}
