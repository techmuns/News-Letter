import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { type Campaign, type ChannelKind, CHANNEL_ORDER, CHANNEL_LABEL } from '../../types'
import { ROUTES } from '../../lib/routes'
import { MicroLabel } from '../MicroLabel'
import { Button } from '../Button'
import { ChannelIcon, IconSend, IconCalendar, IconCheck } from '../icons'

/** Campaign-level publishing: pick channels, then publish now or schedule. */
export function PublishBar({ campaign }: { campaign: Campaign }) {
  const publishChannels = useStore((s) => s.publishChannels)
  const sendChannelsToScheduling = useStore((s) => s.sendChannelsToScheduling)
  const navigate = useNavigate()

  const [sel, setSel] = useState<Set<ChannelKind>>(() => new Set(CHANNEL_ORDER))
  const [published, setPublished] = useState<ChannelKind[] | null>(null)

  const kinds = CHANNEL_ORDER.filter((k) => sel.has(k))

  function toggle(k: ChannelKind) {
    setSel((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  if (published) {
    return (
      <div className="mt-6 rounded-panel border border-[rgba(71,214,161,0.3)] bg-[rgba(71,214,161,0.06)] p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-green text-[#0d2a20]">
            <IconCheck size={13} />
          </span>
          <MicroLabel className="text-green">Published</MicroLabel>
        </div>
        <p className="mt-2.5 text-[13.5px] text-text-2">
          Pushed to {published.map((k) => CHANNEL_LABEL[k]).join(', ')}.
        </p>
        <p className="mt-1 text-[11.5px] text-text-dim">
          Simulated — live publishing integrations connect later.
        </p>
        <button
          type="button"
          onClick={() => setPublished(null)}
          className="mt-3 text-[12px] font-medium text-violet transition-opacity hover:opacity-80"
        >
          Back to publish options
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-panel border border-border bg-surface p-5 shadow-panel">
      <MicroLabel className="text-text-2">Publish</MicroLabel>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
        Choose the channels to publish, then push live or send to Scheduling.
      </p>

      {/* channel selection */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        {CHANNEL_ORDER.map((k) => {
          const on = sel.has(k)
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
                on
                  ? 'border-[rgba(145,71,245,0.5)] bg-purple-soft text-violet'
                  : 'border-border text-text-muted hover:border-border-strong hover:text-text-2',
              )}
            >
              <ChannelIcon kind={k} size={14} />
              {CHANNEL_LABEL[k]}
              <span
                className={cn(
                  'grid h-4 w-4 place-items-center rounded border transition-colors',
                  on ? 'border-transparent bg-violet text-[#160c26]' : 'border-border text-transparent',
                )}
              >
                <IconCheck size={10} />
              </span>
            </button>
          )
        })}
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-border-soft pt-4">
        <Button
          variant="primary"
          size="md"
          disabled={kinds.length === 0}
          onClick={() => {
            publishChannels(campaign.id, kinds)
            setPublished(kinds)
          }}
        >
          <IconSend size={15} /> Publish now
        </Button>
        <Button
          variant="ghost"
          size="md"
          disabled={kinds.length === 0}
          onClick={() => {
            sendChannelsToScheduling(campaign.id, kinds)
            navigate(ROUTES.scheduling)
          }}
        >
          <IconCalendar size={15} /> Schedule for later
        </Button>
        <span className="ml-auto text-[11px] text-text-dim">
          {kinds.length} channel{kinds.length === 1 ? '' : 's'} selected
        </span>
      </div>
    </div>
  )
}
