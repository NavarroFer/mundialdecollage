import { NextResponse } from 'next/server'
import { isPayPalServerConfigured, paypal } from '@/lib/payments/paypal/client'
import { recordOneTimeCapture } from '@/lib/payments/paypal/handlers'

export const runtime = 'nodejs'

type CaptureOrder = {
  id: string
  status: string
  purchase_units?: Array<{ payments?: { captures?: Array<Record<string, unknown>> } }>
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isPayPalServerConfigured) return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
  const { id } = await params
  try {
    const result = await paypal<CaptureOrder>(`/v2/checkout/orders/${id}/capture`, { method: 'POST', requestId: `capture-${id}` })
    const capture = result.purchase_units?.[0]?.payments?.captures?.[0]
    if (result.status !== 'COMPLETED' || !capture) return NextResponse.json({ status: result.status }, { status: 402 })
    await recordOneTimeCapture(capture, result.id)
    return NextResponse.json({ status: 'COMPLETED' })
  } catch (error) {
    console.error('paypal capture failed', error)
    return NextResponse.json({ error: 'Could not capture order' }, { status: 502 })
  }
}
