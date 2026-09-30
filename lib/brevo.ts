// Brevo is deliberately limited to bulk campaigns. Transactional flows keep
// using lib/resend.ts so a newsletter outage cannot affect sign-in or receipt
// emails.
export const isBrevoConfigured = Boolean(process.env.BREVO_API_KEY)

type BrevoResult = { id?: string; messageId?: string; code?: string; message?: string }

export async function sendBrevoCampaignEmail(input: {
  to: string
  subject: string
  htmlContent: string
  sender: { name: string; email: string }
}): Promise<{ id: string | null; error: string | null }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { id: null, error: 'BREVO_API_KEY no está configurada' }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: input.sender,
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.htmlContent,
      }),
    })
    const result = (await response.json().catch(() => ({}))) as BrevoResult
    if (!response.ok) return { id: null, error: result.message ?? `Brevo respondió ${response.status}` }
    return { id: result.messageId ?? result.id ?? null, error: null }
  } catch (error) {
    return { id: null, error: error instanceof Error ? error.message : 'No se pudo conectar con Brevo' }
  }
}
