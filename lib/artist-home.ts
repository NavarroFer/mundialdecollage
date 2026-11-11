// Who sees the Comunidad feed as the home. Anonymous visitors keep the public
// page (the CDN copy). An admin looking at the site as an admin keeps it too,
// so they can still check what everyone else sees. «Ver como artista» and an
// onboarded artist get the feed. ?sitio=1 always shows the public page.

export function artistSeesFeedHome(input: {
  signedIn: boolean
  onboarded: boolean
  admin: boolean
  adminView: boolean
  forceSite: boolean
}): boolean {
  if (input.forceSite || !input.signedIn) return false
  if (input.admin) return !input.adminView
  return input.onboarded
}
