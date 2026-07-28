import { type EmailContent } from '../../types'
import { MicroLabel } from '../MicroLabel'
import { IconEmail } from '../icons'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b3e6a]">
        {label}
      </p>
      <p className="text-[15px] leading-[1.62] text-[#2d1829]">{children}</p>
    </div>
  )
}

/** Renders the newsletter as it will land in the inbox (§3.3). */
export function EmailPreview({ content }: { content: EmailContent }) {
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
      <div className="mx-auto max-w-[600px] rounded-[10px] bg-[#f3eef3] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:p-6">
        <div className="rounded-[8px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:p-8">
          {/* masthead */}
          <div className="flex items-center justify-between border-b border-[#ecdff0] pb-4">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[#4b1d3f]">
                <span className="h-2 w-2 rounded-full bg-[#d6c1e8]" />
              </span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2d1829]">
                Munshot Intelligence
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#857487]">
              Weekly
            </span>
          </div>

          <div className="space-y-6 pt-6">
            <Section label="The idea">{content.idea}</Section>
            <Section label="The story">{content.story}</Section>

            {/* takeaway — highlighted */}
            <div className="rounded-[8px] border-l-2 border-[#4b1d3f] bg-[#f7f1f8] px-4 py-3">
              <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b3e6a]">
                The takeaway
              </p>
              <p className="text-[15px] font-medium leading-[1.6] text-[#2d1829]">
                {content.takeaway}
              </p>
            </div>

            {/* CTA */}
            <div className="pt-1">
              <span className="inline-flex items-center rounded-lg bg-[#2d1829] px-5 py-3 text-[13.5px] font-semibold text-white">
                {content.ctaLabel} →
              </span>
              <p className="mt-3 text-[12px] leading-relaxed text-[#857487]">
                You’re receiving this because you follow Munshot market intelligence.
                <br />
                Manage preferences · Unsubscribe
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
