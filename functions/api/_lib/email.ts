/* Email newsletter sending — provider-agnostic with a Resend default.
   Swap providers by setting EMAIL_PROVIDER=sendgrid (or add your own branch).
   Recipients are BCC'd so they never see each other's addresses. */
import type { Env } from './env'
import { ApiError } from './http'

export interface SendEmailInput {
  subject: string
  html: string
  recipients: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function normalizeRecipients(list: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of list) {
    const e = String(raw || '').trim().toLowerCase()
    if (EMAIL_RE.test(e)) seen.add(e)
  }
  return [...seen]
}

/** Parses "Name <email@x>" or a bare address into { name?, email }. */
function parseAddress(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  if (m) return { name: m[1] || undefined, email: m[2] }
  return { email: from.trim() }
}

export async function sendEmail(env: Env, input: SendEmailInput) {
  if (!env.EMAIL_FROM) throw new ApiError('EMAIL_FROM is not set (see SETUP.md).', 400)
  if (!input.subject || !input.subject.trim()) throw new ApiError('Email subject is required.', 400)
  if (!input.html || !input.html.trim()) throw new ApiError('Email body is required.', 400)

  const recipients = normalizeRecipients(input.recipients)
  if (!recipients.length) throw new ApiError('No valid recipient email addresses provided.', 400)

  const provider = (env.EMAIL_PROVIDER || 'resend').toLowerCase()
  if (provider === 'sendgrid') return sendViaSendGrid(env, input, recipients)
  return sendViaResend(env, input, recipients)
}

async function sendViaResend(env: Env, input: SendEmailInput, recipients: string[]) {
  if (!env.RESEND_API_KEY) throw new ApiError('RESEND_API_KEY is not set (see SETUP.md).', 400)
  const ids: string[] = []
  // Resend caps recipients per request; BCC in batches of 49 (+1 "to").
  for (const batch of chunk(recipients, 49)) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [env.EMAIL_FROM], // visible "to" is the sender; real recipients are bcc'd
        bcc: batch,
        subject: input.subject,
        html: input.html,
      }),
    })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(`Resend error ${res.status}: ${data?.message || 'send failed'}`, 502)
    }
    if (data?.id) ids.push(data.id)
  }
  return { provider: 'resend', sent: recipients.length, batches: ids.length, ids }
}

async function sendViaSendGrid(env: Env, input: SendEmailInput, recipients: string[]) {
  if (!env.SENDGRID_API_KEY) throw new ApiError('SENDGRID_API_KEY is not set (see SETUP.md).', 400)
  const from = parseAddress(env.EMAIL_FROM!)
  for (const batch of chunk(recipients, 900)) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          { to: [{ email: from.email }], bcc: batch.map((email) => ({ email })) },
        ],
        from,
        subject: input.subject,
        content: [{ type: 'text/html', value: input.html }],
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new ApiError(`SendGrid error ${res.status}: ${t.slice(0, 300)}`, 502)
    }
  }
  return { provider: 'sendgrid', sent: recipients.length, ids: [] }
}
