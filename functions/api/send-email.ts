/* POST /api/send-email — send the newsletter to your network list.
   Body: { subject: string, html: string, recipients?: string[] }
   If recipients is omitted, falls back to the EMAIL_RECIPIENTS env list. */
import { sendEmail } from './_lib/email'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)

    let recipients: string[] = Array.isArray(body?.recipients)
      ? body.recipients.map((r: unknown) => String(r))
      : []
    if (!recipients.length && ctx.env.EMAIL_RECIPIENTS) {
      recipients = ctx.env.EMAIL_RECIPIENTS.split(/[,\n;]+/)
    }

    const result = await sendEmail(ctx.env, {
      subject: String(body?.subject || ''),
      html: String(body?.html || ''),
      recipients,
    })
    return json({ ok: true, ...result })
  })
