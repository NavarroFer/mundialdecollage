import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { isMailConfigured, sendMail } from '@/lib/mail'

// What every scheduled route (vercel.json → app/api/cron/*) shares: Vercel
// Cron calls with `Authorization: Bearer $CRON_SECRET` and nobody else gets
// in; `?dry=1` reports what would happen without doing it; independent jobs
// run so that one failing doesn't stop the rest; problems go to the admins
// by mail.

/** Only Vercel Cron, with the secret. No secret configured: nobody. */
export function isAuthorizedCron(request: Request, secret = process.env.CRON_SECRET): boolean {
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export type CronContext = { request: NextRequest; dryRun: boolean }

/** A cron route's GET: the secret is checked before `handler` runs. */
export function cronRoute(handler: (context: CronContext) => Promise<Response>) {
  return async function GET(request: NextRequest): Promise<Response> {
    if (!isAuthorizedCron(request)) return new NextResponse('Unauthorized', { status: 401 })
    return handler({ request, dryRun: request.nextUrl.searchParams.get('dry') === '1' })
  }
}

export type CronJobOutcome = { result: unknown; problem?: string }

export type CronJob = {
  /** Where its result goes in the route's JSON report. */
  key: string
  /** How the admins' mail names it, in Spanish. */
  label: string
  run: () => Promise<CronJobOutcome>
}

/**
 * Runs the jobs in order; one that throws doesn't stop the rest. Returns
 * each one's result under its key, and the problems to tell the admins.
 */
export async function runCronJobs(jobs: CronJob[]): Promise<{ report: Record<string, unknown>; problems: string[] }> {
  const report: Record<string, unknown> = {}
  const problems: string[] = []
  for (const { key, label, run } of jobs) {
    try {
      const { result, problem } = await run()
      report[key] = result
      if (problem) problems.push(`${label}: ${problem}`)
    } catch (err) {
      const message = errorMessage(err)
      console.error(`${key} failed`, message)
      report[key] = { error: message }
      problems.push(`${label} no salió: ${message}`)
    }
  }
  return { report, problems }
}

/** Mails the admins (or `to`). Without a mail provider, or if it fails, it's only logged. */
export async function mailAdmins(subject: string, text: string, to: string[] = ADMIN_EMAILS): Promise<void> {
  if (!isMailConfigured) return
  const result = await sendMail({ to, subject, text })
  if (!result.ok) console.error(`cron mail failed: ${subject}`, result.error)
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
