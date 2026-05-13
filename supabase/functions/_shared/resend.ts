// Minimal Resend client. Set RESEND_API_KEY and ADMIN_NOTIFICATION_EMAIL
// in the Supabase Edge Functions environment.

const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping email send')
    return
  }

  const from = input.from ?? Deno.env.get('RESEND_FROM') ?? 'noreply@example.com'

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend send failed: ${res.status} ${text}`)
  }
}

export function adminNotificationEmail(): string {
  const email = Deno.env.get('ADMIN_NOTIFICATION_EMAIL')
  if (!email) throw new Error('ADMIN_NOTIFICATION_EMAIL is not set')
  return email
}
