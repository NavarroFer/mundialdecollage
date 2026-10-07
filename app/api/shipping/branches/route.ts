import { CORREO_PROVINCES } from '@/lib/correo-branches'
import { getCorreoBranches } from '@/lib/correo'
import { planById } from '@/lib/store'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const province = url.searchParams.get('province') ?? ''
  const plan = url.searchParams.get('plan')
  if (!Object.values(CORREO_PROVINCES).includes(province) || (plan && !planById(plan))) return Response.json({ error: 'invalid' }, { status: 400 })
  try {
    const branches = await getCorreoBranches(province)
    return Response.json({ branches, payment: 'included', fee: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
