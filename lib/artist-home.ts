// Who sees the obra feed as the home. A signed-in person who has not
// submitted an obra does not: they keep the public site. An admin in
// «ver como artista» does, even without an obra. ?sitio=1 always shows
// the public page. Anonymous visitors never reach this; their copy is static.

export function canSeeObraFeed(input: {
  signedIn: boolean
  participating: boolean
  admin: boolean
  adminView: boolean
}): boolean {
  if (!input.signedIn) return false
  if (input.admin) return !input.adminView
  return input.participating
}

export function artistSeesFeedHome(input: {
  signedIn: boolean
  participating: boolean
  admin: boolean
  adminView: boolean
  forceSite: boolean
}): boolean {
  if (input.forceSite) return false
  return canSeeObraFeed(input)
}
