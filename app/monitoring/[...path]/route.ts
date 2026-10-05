import { NextRequest, NextResponse } from 'next/server'

// Proxies Microsoft Clarity's loader + telemetry endpoints through our own
// domain. `clarity.ms` (all subdomains) sits on common tracker blocklists
// (EasyPrivacy etc.), so browsers with an ad/privacy blocker fail the direct
// request with a synthetic 400 before it ever reaches Clarity. Routing it
// same-origin sidesteps that, since the blocklist match happens client-side.
//
// The upload subdomain isn't fixed — Clarity hands out a different
// single-letter host (u./z./t./r.clarity.ms, ...) on every tag.js response,
// presumably to dodge static blocklists itself — so the proxy path encodes
// whichever *.clarity.ms host tag.js embedded rather than assuming one.
// See components/clarity.tsx for the loader that points here.

const CLARITY_HOST = /^[a-z0-9-]+\.clarity\.ms$/i

// Statuses that can't carry a body: the Response constructor throws if given
// one, and Clarity's telemetry endpoints answer 204.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

// Every page view asked for the tag and the script through this Function,
// uncached. The script's path is versioned (scripts.clarity.ms/0.8.70/...);
// the tag only differs between responses in the upload host it hands out, so
// a region sharing one for 10 minutes changes nothing. Their cookies are
// dropped: this proxy never sends any back upstream, so they were dead
// weight, and a response that sets one can't be cached.
const CDN_CACHE: Record<string, string> = {
  'www.clarity.ms': 'public, max-age=0, s-maxage=600',
  'scripts.clarity.ms': 'public, max-age=86400, s-maxage=86400',
}

// The tag's own hosts, pointed here. All but c.clarity.ms: its c.gif only
// syncs Microsoft's MUID cookie, which can't work through a proxy that drops
// cookies, so the browser goes straight there (or an ad blocker stops it,
// which costs nothing).
const PROXIED_HOST = /https:\/\/((?!c\.clarity\.ms)[a-z0-9-]+\.clarity\.ms)/gi

function stripCookieDomain(cookie: string) {
  return cookie.replace(/;\s*domain=[^;]+/i, '')
}

async function proxy(request: NextRequest, path: string[]) {
  const [host, ...rest] = path
  if (!host || !CLARITY_HOST.test(host)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const headers = new Headers()
  const userAgent = request.headers.get('user-agent')
  if (userAgent) headers.set('user-agent', userAgent)
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  let upstream: Response
  try {
    upstream = await fetch(`https://${host}/${rest.join('/')}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    })
  } catch {
    // Clarity unreachable (dropped TLS handshake and the like): analytics
    // can miss a beat, it's not worth a server error.
    return new NextResponse(null, { status: 502 })
  }

  const body = NULL_BODY_STATUSES.has(upstream.status)
    ? null
    : host === 'www.clarity.ms'
      ? (await upstream.text()).replace(PROXIED_HOST, '/monitoring/$1')
      : upstream.body

  const cacheControl = request.method === 'GET' && upstream.ok ? CDN_CACHE[host] : undefined
  const response = new NextResponse(body as BodyInit, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      ...(cacheControl && { 'cache-control': cacheControl }),
    },
  })

  if (!cacheControl) {
    for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
      response.headers.append('set-cookie', stripCookieDomain(cookie))
    }
  }

  return response
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path)
}
