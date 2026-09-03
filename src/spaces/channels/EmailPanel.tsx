import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { type Campaign, channelApproved } from '../../types'
import { weekBucket, weekdayName } from '../../lib/date'
import { MicroLabel } from '../../components/MicroLabel'
import { StatusChip } from '../../components/StatusChip'
import { Card } from '../../components/Card'
import { SplitLayout, PreviewEmpty } from '../../components/SplitLayout'
import { PreviewShell } from '../../components/preview/PreviewShell'
import { EmailPreview } from '../../components/preview/EmailPreview'
import { cn } from '../../lib/cn'

type Bucket = 'this' | 'next' | 'later' | 'earlier' | 'unscheduled'

const GROUP_ORDER: { key: Bucket; label: string }[] = [
  { key: 'this', label: 'This week' },
  { key: 'next', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'earlier', label: 'Earlier' },
  { key: 'unscheduled', label: 'Not scheduled' },
]

function bucketOf(c: Campaign): Bucket {
  const date = c.email.scheduledDate
  if (!date) return 'unscheduled'
  const b = weekBucket(date)
  if (b === 'past') return 'earlier'
  return b as Bucket
}

function EmailRow({
  campaign,
  active,
  onClick,
  onDelete,
}: {
  campaign: Campaign
  active: boolean
  onClick: () => void
  onDelete?: () => void
}) {
  const email = campaign.email
  const date = email.scheduledDate
  const wday = date ? weekdayName(date).slice(0, 3).toUpperCase() : '—'
  return (
    <Card
      active={active}
      interactive
      onClick={onClick}
      className="group relative flex items-stretch gap-0 p-0"
    >
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete "${campaign.name}"`}
          title="Delete this draft"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-lg text-[15px] leading-none text-text-dim opacity-0 transition-all hover:bg-[rgba(248,113,113,0.12)] hover:text-[#f7a3a3] focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      )}
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-[rgba(255,255,255,0.07)] py-4">
        <span className="micro text-[10px] text-violet">{wday}</span>
        <span className="font-display text-[16px] font-bold leading-none text-text">
          {date ? new Date(`${date}T12:00:00`).getDate() : '·'}
        </span>
      </div>
      <div className="min-w-0 flex-1 p-4">
        <p className="line-clamp-1 text-[13.5px] font-semibold text-text">{email.content.subject}</p>
        <p className="mt-1 line-clamp-1 text-[11.5px] text-text-muted">{campaign.name}</p>
        <div className="mt-2.5">
          <StatusChip status={email.status} />
        </div>
      </div>
    </Card>
  )
}

/** Email history — the generated newsletters, previewable as they land. */
export function EmailPanel() {
  const campaigns = useStore((s) => s.campaigns).filter((c) => channelApproved(c.email))
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const removeCampaign = useStore((s) => s.removeCampaign)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const previewCampaign =
    campaigns.find((c) => c.id === selectedId) ?? (isDesktop ? campaigns[0] ?? null : null)

  const grouped = GROUP_ORDER.map((g) => ({
    ...g,
    items: campaigns
      .filter((c) => bucketOf(c) === g.key)
      .sort((a, b) => (a.email.scheduledDate ?? '').localeCompare(b.email.scheduledDate ?? '')),
  })).filter((g) => g.items.length > 0)

  const list = (
    <div className="flex flex-col gap-6">
      {campaigns.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] leading-relaxed text-text-muted">
          No newsletters yet. Generate one in <strong>Studio</strong> or{' '}
          <strong>Daily Pulse</strong> — it lands here and marks Published when you send.
        </p>
      )}
      {grouped.map((group) => (
        <div key={group.key}>
          <div className={cn('mb-3')}>
            <MicroLabel>{group.label}</MicroLabel>
          </div>
          <div className="flex flex-col gap-3">
            {group.items.map((c) => (
              <EmailRow
                key={c.id}
                campaign={c}
                active={c.id === previewCampaign?.id}
                onClick={() => setSelectedId(c.id)}
                onDelete={() => {
                  removeCampaign(c.id)
                  if (selectedId === c.id) setSelectedId(null)
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const preview = previewCampaign ? (
    <PreviewShell campaign={previewCampaign} kind="email" onBack={() => setSelectedId(null)}>
      <EmailPreview
        content={previewCampaign.email.content}
        heroImage={previewCampaign.heroImage}
        headline={previewCampaign.linkedin.content.headline}
        dateLabel={new Date(previewCampaign.createdAt).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select a send to preview the newsletter." />
  )

  return <SplitLayout list={list} preview={preview} hasSelection={!!selectedId} />
}
