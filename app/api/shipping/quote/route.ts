import { getCorreoBranches, quoteSubscriptionShipping } from '@/lib/correo'
import { CORREO_PROVINCES } from '@/lib/correo-branches'
import { planById } from '@/lib/store'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const province = query.get('province') ?? ''
  const plan = planById(query.get('plan') ?? '')
  const code = query.get('branch') ?? ''
  if (!plan || !Object.values(CORREO_PROVINCES).includes(province) || !/^[A-Z0-9_-]{2,20}$/i.test(code)) return Response.json({ error: 'invalid' }, { status: 400 })
  try {
    const branch = (await getCorreoBranches(province)).find((item) => item.code === code)
    if (!branch) return Response.json({ error: 'invalid' }, { status: 400 })
    const fee = await quoteSubscriptionShipping(plan.id, branch)
    return Response.json({ fee, total: Math.round((plan.priceArs + fee) * 100) / 100 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
