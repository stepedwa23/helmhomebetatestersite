// Minimal Resend client. Set RESEND_API_KEY and ADMIN_NOTIFICATION_EMAIL
// in the Supabase Edge Functions environment.

const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  from?: string
  /**
   * Optional Reply-To header. When set, an email client's "Reply" action
   * composes to this address instead of `from`. Used by the tester messages
   * channel so admin can hit Reply and respond directly to the tester even
   * though the From: is our system sender.
   */
  replyTo?: string | string[]
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping email send')
    return
  }

  const from = input.from ?? Deno.env.get('RESEND_FROM') ?? 'noreply@example.com'

  const payload: Record<string, unknown> = {
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  }
  if (input.replyTo) payload.reply_to = input.replyTo

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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
