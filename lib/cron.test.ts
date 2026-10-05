import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mail = vi.hoisted(() => ({ configured: true, sendMail: vi.fn() }))
vi.mock('@/lib/mail', () => ({
  get isMailConfigured() {
    return mail.configured
  },
  sendMail: mail.sendMail,
}))

import { ADMIN_EMAILS } from '@/lib/admin'
import { cronRoute, isAuthorizedCron, mailAdmins, runCronJobs } from './cron'

const request = (path: string, authorization?: string) =>
  new NextRequest(`https://mundialdecollage.com.ar${path}`, { headers: authorization ? { authorization } : {} })

beforeEach(() => {
  mail.configured = true
  mail.sendMail.mockReset().mockResolvedValue({ ok: true, id: 'x' })
  vi.stubEnv('CRON_SECRET', 'shh')
})

describe('isAuthorizedCron', () => {
  it('lets in only the bearer secret', () => {
    expect(isAuthorizedCron(request('/', 'Bearer shh'))).toBe(true)
    expect(isAuthorizedCron(request('/', 'Bearer nope'))).toBe(false)
    expect(isAuthorizedCron(request('/'))).toBe(false)
  })

  it('lets nobody in when no secret is configured', () => {
    expect(isAuthorizedCron(request('/', 'Bearer '), '')).toBe(false)
    expect(isAuthorizedCron(request('/', 'Bearer undefined'), undefined)).toBe(false)
  })
})

describe('cronRoute', () => {
  it('answers 401 without running the handler', async () => {
    const handler = vi.fn()
    const response = await cronRoute(handler)(request('/api/cron/x'))
    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('tells the handler whether it is a dry run', async () => {
    const handler = vi.fn(async ({ dryRun }: { dryRun: boolean }) => Response.json({ dryRun }))
    const dry = await cronRoute(handler)(request('/api/cron/x?dry=1', 'Bearer shh'))
    const real = await cronRoute(handler)(request('/api/cron/x', 'Bearer shh'))
    expect(await dry.json()).toEqual({ dryRun: true })
    expect(await real.json()).toEqual({ dryRun: false })
  })
})

describe('runCronJobs', () => {
  it('keeps going after a job throws, and labels the problems', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ran: string[] = []
    const { report, problems } = await runCronJobs([
      { key: 'a', label: 'Primero', run: async () => (ran.push('a'), { result: 1 }) },
      { key: 'b', label: 'Segundo', run: async () => { throw new Error('se rompió') } },
      { key: 'c', label: 'Tercero', run: async () => (ran.push('c'), { result: 3, problem: 'falló para 2' }) },
    ])
    expect(ran).toEqual(['a', 'c'])
    expect(report).toEqual({ a: 1, b: { error: 'se rompió' }, c: 3 })
    expect(problems).toEqual(['Segundo no salió: se rompió', 'Tercero: falló para 2'])
  })
})

describe('mailAdmins', () => {
  it('mails the admins unless told otherwise', async () => {
    await mailAdmins('Asunto', 'Texto')
    await mailAdmins('Asunto', 'Texto', ['otra@example.com'])
    expect(mail.sendMail).toHaveBeenNthCalledWith(1, { to: ADMIN_EMAILS, subject: 'Asunto', text: 'Texto' })
    expect(mail.sendMail).toHaveBeenNthCalledWith(2, { to: ['otra@example.com'], subject: 'Asunto', text: 'Texto' })
  })

  it('does nothing without a mail provider', async () => {
    mail.configured = false
    await mailAdmins('Asunto', 'Texto')
    expect(mail.sendMail).not.toHaveBeenCalled()
  })
})

// Every scheduled route answers 401 to anyone but Vercel Cron: a new one
// that skips cronRoute fails here.
describe('scheduled routes', () => {
  const vercel = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../vercel.json'), 'utf8')) as { crons: { path: string }[] }

  it.each(vercel.crons.map((cron) => cron.path))('%s needs the cron secret', async (cronPath) => {
    const route = (await import(`@/app${cronPath}/route`)) as { GET: (request: NextRequest) => Promise<Response> }
    expect((await route.GET(request(cronPath))).status).toBe(401)
    expect((await route.GET(request(cronPath, 'Bearer wrong'))).status).toBe(401)
  })
})
