import { type ArticleContent, type Promotion } from '../../types'
import { MicroLabel } from '../MicroLabel'
import { IconArticle, IconArrowRight } from '../icons'

/** Renders the long-form article with the Munshot CTA at the end (§3.4). */
export function ArticlePreview({
  content,
  promo,
}: {
  content: ArticleContent
  promo?: Promotion
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <IconArticle size={14} className="text-violet" />
        <MicroLabel>Article preview</MicroLabel>
      </div>

      <article className="mx-auto max-w-[660px] overflow-hidden rounded-panel border border-border bg-[rgba(255,255,255,0.02)]">
        {/* hero band */}
        <div className="relative flex h-28 items-end overflow-hidden border-b border-border bg-[linear-gradient(135deg,rgba(170,152,248,0.2),rgba(170,152,248,0.03)_60%,transparent)] px-6 py-4 sm:px-9">
          <MicroLabel className="micro-violet">{content.hero}</MicroLabel>
        </div>

        <div className="px-6 py-7 sm:px-9 sm:py-9">
          <h1 className="font-display text-[27px] font-bold leading-[1.15] tracking-tight text-text sm:text-[32px]">
            {content.title}
          </h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-text-2">{content.deck}</p>

          {/* byline */}
          <div className="mt-5 flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] pb-6">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(157,140,245,0.14)] border border-[rgba(157,140,245,0.3)] font-display text-[12px] font-bold text-violet">
              M
            </span>
            <div className="leading-tight">
              <p className="text-[12.5px] font-medium text-text-2">Munshot Intelligence</p>
              <MicroLabel className="mt-0.5 text-[9.5px]">Research desk</MicroLabel>
            </div>
          </div>

          {/* body */}
          <div className="mt-6 space-y-5">
            {content.sections.map((sec, i) => (
              <div key={i}>
                {sec.heading && (
                  <h2 className="mb-2 font-display text-[17px] font-bold text-text">
                    {sec.heading}
                  </h2>
                )}
                <p className="text-[15px] leading-[1.72] text-text-2">{sec.body}</p>
              </div>
            ))}
          </div>

          {/* Munshot CTA — quiet, relevant pointer (§ "How promotion works") */}
          <div className="glow-active mt-8 rounded-card p-5">
            <MicroLabel className="micro-violet">Go deeper</MicroLabel>
            <h3 className="mt-2 font-display text-[16px] font-bold text-text">{content.ctaTitle}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{content.ctaBody}</p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-[#12101e] transition-all hover:brightness-110"
            >
              {content.ctaLabel}
              <IconArrowRight size={15} />
            </button>
            {promo && (
              <p className="mt-3 border-t border-[rgba(255,255,255,0.06)] pt-3 text-[11.5px] text-text-muted">
                {promo.name} — {promo.benefit}
              </p>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
