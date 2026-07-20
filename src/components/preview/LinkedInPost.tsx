import { type LinkedInContent } from '../../types'
import { MicroLabel } from '../MicroLabel'
import { IconLinkedIn } from '../icons'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="font-semibold text-[#1b1f23]">{value.toLocaleString()}</span>{' '}
      <span className="text-[#5e6670]">{label}</span>
    </span>
  )
}

/** Renders a LinkedIn post as it will actually appear (§3.2). */
export function LinkedInPost({ content }: { content: LinkedInContent }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <IconLinkedIn size={14} className="text-[#0a66c2]" />
        <MicroLabel>LinkedIn preview</MicroLabel>
      </div>

      {/* Authentic light LinkedIn card on the dark canvas */}
      <div className="mx-auto max-w-[560px] overflow-hidden rounded-[10px] bg-white text-[#1b1f23] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* author */}
        <div className="flex items-start gap-3 px-4 pt-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9D8CF5] to-[#6E64A8] font-display text-[18px] font-bold text-white">
            {content.authorAvatar}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-1 text-[14px] font-semibold text-[#1b1f23]">
              {content.authorName}
              <span className="text-[#5e6670]">· 1st</span>
            </p>
            <p className="truncate text-[12px] text-[#5e6670]">{content.authorHandle}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#5e6670]">
              2h · <span aria-hidden>🌐</span>
            </p>
          </div>
          <span className="text-[20px] leading-none text-[#5e6670]">···</span>
        </div>

        {/* body */}
        <div className="whitespace-pre-line px-4 py-3 text-[14px] leading-[1.5] text-[#1b1f23]">
          {content.body}
        </div>

        {/* social counts */}
        <div className="flex items-center justify-between px-4 py-2 text-[12.5px]">
          <span className="flex items-center gap-1">
            <span className="flex -space-x-1">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#378fe9] text-[9px]">👍</span>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#df704d] text-[9px]">❤️</span>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#f5bb5c] text-[9px]">💡</span>
            </span>
            <span className="ml-1 text-[#5e6670]">{content.reactions.toLocaleString()}</span>
          </span>
          <span className="flex gap-3 text-[#5e6670]">
            <Stat label="comments" value={content.comments} />
            <Stat label="reposts" value={content.reposts} />
          </span>
        </div>

        {/* actions */}
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
