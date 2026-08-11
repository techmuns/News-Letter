/* Builds the branded, inbox-safe HTML for the newsletter send — a multi-section
   "Munshot Edge" digest that mirrors a professional research briefing:
     masthead → dated welcome → Top Story (narrative, key findings, Related
     Reading & Source) → Trending Now → Chart of the Day → Spotlight (Wall Street
     View / Press View + a pulled quote) → takeaway → CTA.
   Inline styles + tables only — email clients strip <style> and external CSS. */
import { type GeneratedContent } from './api'

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface EmailSource {
  source: string
  link: string
  title?: string
  date?: string
}

export interface EmailBuildOpts {
  ctaUrl?: string
  brand?: string
  heroImageUrl?: string
  sources?: EmailSource[]
  /** Top-story headline (distinct from the subject). */
  headline?: string
  /** e.g. "August 6, 2026" */
  dateLabel?: string
  /** Chart-of-the-Day image (data URL in preview; hosted URL in a sent email). */
  chartImageUrl?: string
  /** one-line, grounded explainer under the chart */
  chartCaption?: string
  /** byline for the Spotlight section */
  spotlightByline?: string
}

const INK = '#14121c'
const BODY = '#34313e'
const MUTED = '#8a8794'
const RULE = '#e7e5f0'
const ACCENT = '#5b4bd6' // section labels
const LINK = '#3a4fd6'
const PAGE = '#edecf1'

function card(inner: string): string {
  return `<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td style="padding:26px 32px;">${inner}</td></tr></table></td></tr>`
}
const spacer = `<tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>`

function sectionLabel(text: string): string {
  return `<div style="font:700 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${ACCENT};letter-spacing:.02em;">${esc(
    text,
  )}</div><div style="border-top:1px solid ${RULE};margin:9px 0 16px;"></div>`
}

/** "► Label" sub-heading + its paragraph, used inside the Spotlight. */
function viewBlock(label: string, text: string): string {
  if (!text) return ''
  return `<p style="font-size:13.5px;font-weight:700;color:${INK};margin:14px 0 5px;"><span style="color:${ACCENT};">&#9656;</span> ${esc(
    label,
  )}</p><p style="font-size:14.5px;line-height:1.6;color:${BODY};margin:0;">${esc(text)}</p>`
}

export function buildEmailHtml(email: GeneratedContent['email'], opts?: EmailBuildOpts): string {
  const brand = opts?.brand || 'Munshot Edge'
  const ctaUrl = opts?.ctaUrl || 'https://munshot.io'
  const sources = (opts?.sources || []).filter((s) => s && s.link)
  const keyPoints = (email.keyPoints || []).filter((p) => p && (p.lead || p.detail))
  const spotlight = email.spotlight
  const headline = (opts?.headline || email.subject || '').trim()
  const dateLabel = opts?.dateLabel || ''
  const byline = opts?.spotlightByline || 'Munshot Research Desk'

  // masthead — brand with the last word accented (e.g. "Munshot" + "Edge")
  const parts = brand.split(' ')
  const brandHtml =
    parts.length > 1
      ? `${esc(parts.slice(0, -1).join(' '))} <span style="color:#b9abf6;">${esc(parts[parts.length - 1])}</span>`
      : esc(brand)

  const hero = opts?.heroImageUrl
    ? `<img src="${esc(opts.heroImageUrl)}" alt="" width="536" style="display:block;width:100%;height:auto;border:0;border-radius:8px;margin:0 0 18px;" />`
    : ''

  const related =
    sources[0] && (sources[0].title || sources[0].link)
      ? `<p style="font-size:14.5px;color:${BODY};margin:0 0 14px;"><strong style="color:${INK};">Related Reading:</strong> <a href="${esc(
          sources[0].link,
        )}" style="color:${LINK};text-decoration:underline;">${esc(sources[0].title || sources[0].link)}</a></p>`
      : ''

  const points = keyPoints.length
    ? `<ul style="margin:4px 0 16px;padding-left:20px;">${keyPoints
        .map((p) => {
          const lead = p.lead
            ? `<strong style="color:${INK};">${esc(p.lead)}${p.detail ? ':' : ''}</strong>${p.detail ? ' ' : ''}`
            : ''
          return `<li style="font-size:14.5px;line-height:1.6;color:${BODY};margin:0 0 10px;">${lead}${esc(
            p.detail,
          )}</li>`
        })
        .join('')}</ul>`
    : ''

  const sourceLine = sources[0]
    ? `<p style="font-size:12.5px;font-style:italic;color:${MUTED};margin:2px 0 0;">Source: ${esc(
        sources[0].source || 'Munshot research',
      )}${sources[0].date ? ` · ${esc(sources[0].date)}` : ''}</p>`
    : ''

  const trendingItems = sources.slice(1, 5)
  const trending = trendingItems.length
    ? card(
        sectionLabel('Trending Now') +
          trendingItems
            .map(
              (s) =>
                `<p style="font-size:14.5px;line-height:1.5;margin:0 0 12px;"><span style="color:${INK};">&#9656;</span> <a href="${esc(
                  s.link,
                )}" style="color:${LINK};text-decoration:underline;font-weight:600;">${esc(s.title || s.source || s.link)}</a></p>`,
            )
            .join(''),
      )
    : ''

  const chart = opts?.chartImageUrl
    ? card(
        sectionLabel('Chart of the Day') +
          `<img src="${esc(
            opts.chartImageUrl,
          )}" alt="" width="536" style="display:block;width:100%;height:auto;border:0;border-radius:8px;margin:0 0 14px;" />` +
          (opts.chartCaption
            ? `<p style="font-size:14px;line-height:1.6;color:${BODY};margin:0;">${esc(opts.chartCaption)}</p>`
            : ''),
      )
    : ''

  const spotlightHtml =
    spotlight && (spotlight.headline || spotlight.story || spotlight.wallStreetView || spotlight.pressView)
      ? card(
          sectionLabel('Spotlight') +
            `<p style="font:600 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};margin:0 0 8px;">By ${esc(
              byline,
            )}</p>` +
            (spotlight.headline
              ? `<h3 style="font-size:19px;font-weight:800;color:${INK};line-height:1.3;margin:0 0 12px;">${esc(
                  spotlight.headline,
                )}</h3>`
              : '') +
            (spotlight.story
              ? `<p style="font-size:14.5px;line-height:1.62;color:${BODY};margin:0 0 6px;">${esc(spotlight.story)}</p>`
              : '') +
            viewBlock('Wall Street View', spotlight.wallStreetView) +
            viewBlock('Press View', spotlight.pressView) +
            (spotlight.pressQuote
              ? `<div style="border-left:3px solid ${ACCENT};margin:14px 0 0;padding:2px 0 2px 16px;"><p style="font-size:16px;line-height:1.5;font-style:italic;color:${INK};margin:0;">&ldquo;${esc(
                  spotlight.pressQuote,
                )}&rdquo;</p></div>`
              : ''),
        )
      : ''

  const welcomeIntro = email.idea
    ? `<p style="font-size:15px;line-height:1.62;color:${BODY};margin:16px 0 0;">${esc(email.idea)}</p>`
    : ''

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${PAGE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:22px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <!-- masthead -->
        <tr><td style="background:#16122a;padding:26px 32px;text-align:center;">
          <span style="font:800 22px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;letter-spacing:.4px;">${brandHtml}</span>
          <div style="height:3px;width:46px;background:#7c6cf0;border-radius:2px;margin:11px auto 0;"></div>
        </td></tr>

        ${spacer}

        <!-- welcome -->
        ${card(
          `${dateLabel ? `<div style="font-size:13px;color:${MUTED};margin:0 0 12px;">${esc(dateLabel)}</div>` : ''}` +
            `<p style="font-weight:700;font-size:16px;color:${INK};line-height:1.5;margin:0;">Welcome to ${esc(
              brand,
            )}, your source for insights into the forces shaping today's markets.</p>` +
            welcomeIntro,
        )}

        ${spacer}

        <!-- top story -->
        ${card(
          sectionLabel('Top Story') +
            `<h2 style="font-size:22px;font-weight:800;color:${INK};line-height:1.25;margin:0 0 16px;">${esc(headline)}</h2>` +
            hero +
            `<p style="font-size:15px;line-height:1.65;color:${BODY};margin:0 0 14px;">${esc(email.story)}</p>` +
            related +
            points +
            sourceLine,
        )}

        ${trending ? spacer + trending : ''}
        ${chart ? spacer + chart : ''}
        ${spotlightHtml ? spacer + spotlightHtml : ''}

        ${spacer}

        <!-- takeaway -->
        ${card(
          `<div style="border-left:3px solid #7c6cf0;background:#f5f3ff;border-radius:8px;padding:14px 16px;">
            <div style="font:700 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${ACCENT};margin-bottom:7px;">The takeaway</div>
            <div style="font-size:15px;line-height:1.55;font-weight:600;color:${INK};">${esc(email.takeaway)}</div>
          </div>`,
        )}

        ${spacer}

        <!-- CTA + footer -->
        ${card(
          `<a href="${esc(ctaUrl)}" style="display:inline-block;background:#16122a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 22px;border-radius:10px;">${esc(
            email.ctaLabel,
          )} &rarr;</a>
          <p style="font-size:12px;line-height:1.6;color:${MUTED};margin:18px 0 0;">You're receiving ${esc(
            brand,
          )} because you follow Munshot market intelligence.<br/>Manage preferences · Unsubscribe</p>`,
        )}

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
