import { type LinkedInContent } from '../../types'
import { MicroLabel } from '../MicroLabel'
import { IconLinkedIn } from '../icons'

/** Renders a LinkedIn post as it will actually appear (§3.2), draft-clean. */
export function LinkedInPost({ content }: { content: LinkedInContent }) {
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
