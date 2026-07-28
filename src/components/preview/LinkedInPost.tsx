import { type LinkedInContent } from '../../types'
import { MicroLabel } from '../MicroLabel'
import { IconLinkedIn } from '../icons'

/** Renders a LinkedIn post as it will actually appear (§3.2): text + a
    graphic carrying the catchy phrase. */
export function LinkedInPost({
  content,
  image,
  topic,
}: {
  content: LinkedInContent
  image?: string
  topic?: string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <IconLinkedIn size={14} className="text-[#0a66c2]" />
        <MicroLabel>LinkedIn preview</MicroLabel>
      </div>

      {/* Authentic light LinkedIn card */}
      <div className="mx-auto max-w-[560px] overflow-hidden rounded-[10px] bg-white text-[#1b1f23] shadow-[0_1px_3px_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* author */}
        <div className="flex items-start gap-3 px-4 pt-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#a896f7] to-[#8a7fc0] font-display text-[18px] font-bold text-white">
            {content.authorAvatar}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[14px] font-semibold text-[#1b1f23]">{content.authorName}</p>
            <p className="truncate text-[12px] text-[#5e6670]">{content.authorHandle}</p>
          </div>
        </div>

        {/* body */}
        <div className="whitespace-pre-line px-4 py-3 text-[14px] leading-[1.5] text-[#1b1f23]">
          {content.body}
        </div>

        {/* branded graphic: picture + catchy phrase on a Munshot template */}
        {image && (
          <div className="relative overflow-hidden border-y border-[#e6e6e6]">
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(28,25,38,0.95)_0%,rgba(28,25,38,0.82)_46%,rgba(42,37,64,0.62)_100%)]" />
            <div className="relative flex min-h-[266px] flex-col justify-between p-6">
              {/* brand */}
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#12101e] ring-1 ring-[rgba(170,152,248,0.55)]">
                  <span className="h-2 w-2 rounded-full bg-[#a896f7]" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#cabff8]">
                  Munshot Intelligence
                </span>
              </div>
              {/* headline */}
              <div>
                {topic && (
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#a896f7]">
                    {topic}
                  </p>
                )}
                <p className="font-display text-[24px] font-bold leading-[1.16] text-white">
                  {content.headline}
                </p>
                <div className="mt-4 h-[3px] w-12 rounded-full bg-[#a896f7]" />
              </div>
            </div>
          </div>
        )}

        {/* actions (no fake metrics) */}
        <div className="grid grid-cols-4 border-t border-[#e6e6e6] py-1 text-[13px] font-medium text-[#5e6670]">
          {['Like', 'Comment', 'Repost', 'Send'].map((a) => (
            <span key={a} className="py-2 text-center">
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
