import { type EmailContent } from '../../types'
import { type EmailSource } from '../../lib/emailTemplate'
import { MicroLabel } from '../MicroLabel'
import { IconEmail } from '../icons'

const INK = '#14121c'
const BODY = '#34313e'
const MUTED = '#8a8794'
const ACCENT = '#5b4bd6'
const LINK = '#3a4fd6'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[13px] font-bold" style={{ color: ACCENT }}>
        {children}
      </div>
      <div className="mt-2 border-t border-[#e7e5f0]" />
    </div>
  )
}

/** One white section card in the rendered newsletter. */
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white px-6 py-5 sm:px-7">{children}</div>
}

/** Renders the newsletter as it will land in the inbox — the full multi-section
    "Munshot Edge" digest (masthead → welcome → Top Story → Trending → Chart of
    the Day → Spotlight → takeaway → CTA). */
export function EmailPreview({
  content,
  heroImage,
  sources,
  headline,
  dateLabel,
  chartImage,
  chartCaption,
  brand = 'Munshot Edge',
  spotlightByline = 'Munshot Research Desk',
}: {
  content: EmailContent
  heroImage?: string
  sources?: EmailSource[]
  headline?: string
  dateLabel?: string
  chartImage?: string
  chartCaption?: string
  brand?: string
  spotlightByline?: string
}) {
  const src = (sources || []).filter((s) => s && s.link)
  const trending = src.slice(1, 5)
  const keyPoints = (content.keyPoints || []).filter((p) => p && (p.lead || p.detail))
  const spot = content.spotlight
  const topHeadline = (headline || content.subject || '').trim()

  const parts = brand.split(' ')
  const brandNode =
    parts.length > 1 ? (
      <>
        {parts.slice(0, -1).join(' ')} <span style={{ color: '#b9abf6' }}>{parts[parts.length - 1]}</span>
      </>
    ) : (
      brand
    )

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <IconEmail size={14} className="text-violet" />
        <MicroLabel>Email preview</MicroLabel>
      </div>

      {/* inbox meta (console-dark) */}
      <div className="mb-3 rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
        <p className="text-[15px] font-semibold text-text">{content.subject}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MicroLabel className="text-text-dim">From</MicroLabel>
          <span className="text-[12.5px] text-text-2">{content.from}</span>
        </div>
        <p className="mt-1.5 text-[12.5px] italic text-text-muted">{content.preheader}</p>
      </div>

      {/* rendered newsletter (light) */}
      <div className="mx-auto max-w-[600px] overflow-hidden rounded-[12px] bg-[#edecf1] p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:p-4">
        {/* masthead */}
        <div className="rounded-t-[8px] bg-[#16122a] px-6 py-6 text-center">
          <div
            className="text-[22px] font-extrabold tracking-[0.4px] text-white"
            style={{ fontWeight: 800 }}
          >
            {brandNode}
          </div>
          <div className="mx-auto mt-3 h-[3px] w-[46px] rounded-full bg-[#7c6cf0]" />
        </div>

        <div className="space-y-3 pt-3">
          {/* welcome */}
          <Panel>
            {dateLabel && <div className="mb-3 text-[13px]" style={{ color: MUTED }}>{dateLabel}</div>}
            <p className="text-[15px] font-bold leading-[1.5]" style={{ color: INK }}>
              Welcome to {brand}, your source for insights into the forces shaping today's markets.
            </p>
            {content.idea && (
              <p className="mt-3 text-[14.5px] leading-[1.62]" style={{ color: BODY }}>
                {content.idea}
              </p>
            )}
          </Panel>

          {/* top story */}
          <Panel>
            <SectionLabel>Top Story</SectionLabel>
            <h2 className="mb-3 text-[21px] font-extrabold leading-[1.25]" style={{ color: INK }}>
              {topHeadline}
            </h2>
            {heroImage && (
              <img
                src={heroImage}
                alt=""
                className="mb-4 block w-full rounded-[8px] border border-[#ece9f7]"
              />
            )}
            <p className="text-[14.5px] leading-[1.65]" style={{ color: BODY }}>
              {content.story}
            </p>
            {src[0] && (
              <p className="mt-3 text-[14px]" style={{ color: BODY }}>
                <span className="font-bold" style={{ color: INK }}>
                  Related Reading:{' '}
                </span>
                <a
                  href={src[0].link}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                  style={{ color: LINK }}
                >
                  {src[0].title || src[0].link}
                </a>
              </p>
            )}
            {keyPoints.length > 0 && (
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {keyPoints.map((p, i) => (
                  <li key={i} className="text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
                    {p.lead && (
                      <strong style={{ color: INK }}>
                        {p.lead}
                        {p.detail ? ': ' : ''}
                      </strong>
                    )}
                    {p.detail}
                  </li>
                ))}
              </ul>
            )}
            {src[0] && (
              <p className="mt-3 text-[12.5px] italic" style={{ color: MUTED }}>
                Source: {src[0].source || 'Munshot research'}
                {src[0].date ? ` · ${src[0].date}` : ''}
              </p>
            )}
          </Panel>

          {/* trending now */}
          {trending.length > 0 && (
            <Panel>
              <SectionLabel>Trending Now</SectionLabel>
              <div className="space-y-2.5">
                {trending.map((s, i) => (
                  <p key={i} className="text-[14.5px] leading-[1.5]">
                    <span style={{ color: INK }}>&#9656;</span>{' '}
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                      style={{ color: LINK }}
                    >
                      {s.title || s.source || s.link}
                    </a>
                  </p>
                ))}
              </div>
            </Panel>
          )}

          {/* chart of the day */}
          {chartImage && (
            <Panel>
              <SectionLabel>Chart of the Day</SectionLabel>
              <img
                src={chartImage}
                alt=""
                className="mb-3 block w-full rounded-[8px] border border-[#ece9f7]"
              />
              {chartCaption && (
                <p className="text-[14px] leading-[1.6]" style={{ color: BODY }}>
                  {chartCaption}
                </p>
              )}
            </Panel>
          )}

          {/* spotlight */}
          {spot && (spot.headline || spot.story || spot.wallStreetView || spot.pressView) && (
            <Panel>
              <SectionLabel>Spotlight</SectionLabel>
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: MUTED }}
              >
                By {spotlightByline}
              </p>
              {spot.headline && (
                <h3 className="mb-3 text-[18px] font-extrabold leading-[1.3]" style={{ color: INK }}>
                  {spot.headline}
                </h3>
              )}
              {spot.story && (
                <p className="text-[14.5px] leading-[1.62]" style={{ color: BODY }}>
                  {spot.story}
                </p>
              )}
              {spot.wallStreetView && (
                <>
                  <p className="mt-3.5 mb-1 text-[13.5px] font-bold" style={{ color: INK }}>
                    <span style={{ color: ACCENT }}>&#9656;</span> Wall Street View
                  </p>
                  <p className="text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
                    {spot.wallStreetView}
                  </p>
                </>
              )}
              {spot.pressView && (
                <>
                  <p className="mt-3.5 mb-1 text-[13.5px] font-bold" style={{ color: INK }}>
                    <span style={{ color: ACCENT }}>&#9656;</span> Press View
                  </p>
                  <p className="text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
                    {spot.pressView}
                  </p>
                </>
              )}
              {spot.pressQuote && (
                <div className="mt-3.5 border-l-[3px] pl-4" style={{ borderColor: ACCENT }}>
                  <p className="text-[16px] italic leading-[1.5]" style={{ color: INK }}>
                    &ldquo;{spot.pressQuote}&rdquo;
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* takeaway */}
          <Panel>
            <div className="rounded-[8px] border-l-[3px] border-[#7c6cf0] bg-[#f5f3ff] px-4 py-3">
              <p
                className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]"
                style={{ color: ACCENT }}
              >
                The takeaway
              </p>
              <p className="text-[14.5px] font-semibold leading-[1.55]" style={{ color: INK }}>
                {content.takeaway}
              </p>
            </div>
          </Panel>

          {/* CTA */}
          <div className="rounded-b-[8px] bg-white px-6 py-5 sm:px-7">
            <span className="inline-flex items-center rounded-[10px] bg-[#16122a] px-5 py-3 text-[13.5px] font-semibold text-white">
              {content.ctaLabel} →
            </span>
            <p className="mt-4 text-[12px] leading-relaxed" style={{ color: MUTED }}>
              You're receiving {brand} because you follow Munshot market intelligence.
              <br />
              Manage preferences · Unsubscribe
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
