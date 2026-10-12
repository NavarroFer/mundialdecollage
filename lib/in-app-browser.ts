// Instagram's and Facebook's own browsers, where most links to the site are
// opened: their file pickers and Google sign-in are the least reliable part
// of the trip, so /onboarding asks to switch to a real browser, and every
// step measured in lib/funnel.ts records which one it came from.
export type InAppBrowser = 'instagram' | 'facebook'

export function inAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (!userAgent) return null
  if (/\bInstagram\b/.test(userAgent)) return 'instagram'
  // FBAN/FBAV: the Facebook app (and Messenger's FBAN/MessengerForiOS); FB_IAB: its Android browser.
  if (/\bFBAN\/|\bFBAV\/|\bFB_IAB\//.test(userAgent)) return 'facebook'
  return null
}
