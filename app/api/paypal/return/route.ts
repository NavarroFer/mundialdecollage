import { NextResponse } from 'next/server'
import { capturePayPalOrder } from '@/lib/payments/providers/paypal'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'

// Where PayPal sends a buyer back from a checkout of lib/payments/providers/
// paypal.ts, approved (?token=<order>) or cancelled (?cancel=1). An approved
// order is captured here, then the buyer goes on to the return URL the
// checkout was opened with for how it went: only ever one of this site's.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const site = new URL(getSiteUrl())
  const to = (outcome: 'success' | 'pending' | 'failure') => {
    try {
      const url = new URL(params.get(outcome) ?? '/', site)
      return url.origin === site.origin ? url : site
    } catch {
      return site
    }
  }

  const token = params.get('token')
  if (params.has('cancel') || !token) return NextResponse.redirect(to('failure'))
  const status = await capturePayPalOrder(token)
  return NextResponse.redirect(to(status === 'approved' ? 'success' : status === 'pending' ? 'pending' : 'failure'))
}
