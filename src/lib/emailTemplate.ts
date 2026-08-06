/* Builds the branded, inbox-safe HTML for the newsletter send.
   Inline styles only — email clients strip <style> and external CSS. */
import { type GeneratedContent } from './api'

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildEmailHtml(
  email: GeneratedContent['email'],
  opts?: {
    ctaUrl?: string
    brand?: string
    heroImageUrl?: string
    /** Source links to list under the newsletter (Topic mode). */
    sources?: { source: string; link: string }[]
  },
): string {
  const brand = opts?.brand || 'Munshot Intelligence'
  const ctaUrl = opts?.ctaUrl || 'https://munshot.io'
  const hero = opts?.heroImageUrl
    ? `<tr><td style="padding:0;"><img src="${esc(opts.heroImageUrl)}" alt="Munshot Daily Pulse" width="600" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
    : ''
  const srcRows = (opts?.sources || [])
    .filter((s) => s && s.link)
    .slice(0, 4)
    .map(
      (s) =>
        `<div style="font-size:13px;line-height:1.5;margin-bottom:4px;"><a href="${esc(s.link)}" style="color:#5b4bd6;text-decoration:none;">${esc(s.source || s.link)}</a></div>`,
    )
    .join('')
  const sources = srcRows
    ? `<tr><td style="padding:0 32px 20px;">
          <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a7fce;margin-bottom:8px;">Sources</div>
          ${srcRows}
        </td></tr>`
    : ''
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f6f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:28px 32px 16px;border-bottom:1px solid #ece9f7;">
          <span style="font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#12101e;">${esc(brand)}</span>
        </td></tr>
        ${hero}
        <tr><td style="padding:28px 32px 8px;">
          <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a7fce;margin-bottom:6px;">The idea</div>
          <div style="font-size:16px;line-height:1.6;color:#2a2a33;">${esc(email.idea)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;">
          <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a7fce;margin-bottom:6px;">The story</div>
          <div style="font-size:16px;line-height:1.6;color:#2a2a33;">${esc(email.story)}</div>
        </td></tr>
        <tr><td style="padding:8px 32px 20px;">
          <div style="border-left:3px solid #9D8CF5;background:#f7f5ff;border-radius:8px;padding:14px 16px;">
            <div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a7fce;margin-bottom:6px;">The takeaway</div>
            <div style="font-size:16px;line-height:1.55;font-weight:600;color:#2a2a33;">${esc(email.takeaway)}</div>
          </div>
        </td></tr>
        ${sources}
        <tr><td style="padding:4px 32px 32px;">
          <a href="${esc(ctaUrl)}" style="display:inline-block;background:#12101e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 22px;border-radius:10px;">${esc(email.ctaLabel)} &rarr;</a>
          <p style="font-size:12px;line-height:1.6;color:#9a97a8;margin:18px 0 0;">You're receiving this because you follow Munshot market intelligence.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
