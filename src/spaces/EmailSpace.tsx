import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { ROUTES, channelPath } from '../lib/routes'
import { type Campaign } from '../types'
import { weekBucket, weekdayName } from '../lib/date'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { StatusChip } from '../components/StatusChip'
import { Card } from '../components/Card'
import { SplitLayout, PreviewEmpty } from '../components/SplitLayout'
import { PreviewShell } from '../components/preview/PreviewShell'
import { EmailPreview } from '../components/preview/EmailPreview'

type Bucket = 'this' | 'next' | 'later' | 'earlier' | 'unscheduled'

const GROUP_ORDER: { key: Bucket; label: string; caption?: string }[] = [
  { key: 'this', label: 'This week', caption: 'Mon insight · Wed story · Fri actionable' },
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
}: {
  campaign: Campaign
  active: boolean
  onClick: () => void
}) {
  const email = campaign.email
  const date = email.scheduledDate
  const wday = date ? weekdayName(date).slice(0, 3).toUpperCase() : '—'
  return (
    <Card active={active} interactive onClick={onClick} className="flex items-stretch gap-0 p-0">
      {/* weekday rail */}
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-[rgba(255,255,255,0.07)] py-4">
        <span className="micro text-[10px] text-violet">{wday}</span>
        <span className="font-display text-[16px] font-bold leading-none text-text">
          {date ? new Date(`${date}T12:00:00`).getDate() : '·'}
        </span>
      </div>
      {/* body */}
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

export function EmailSpace() {
  const campaigns = useStore((s) => s.campaigns)
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const selected = campaigns.find((c) => c.id === campaignId) ?? null

  const grouped = GROUP_ORDER.map((g) => ({
    ...g,
    items: campaigns
      .filter((c) => bucketOf(c) === g.key)
      .sort((a, b) =>
        (a.email.scheduledDate ?? '').localeCompare(b.email.scheduledDate ?? ''),
      ),
  })).filter((g) => g.items.length > 0)

  const list = (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <div key={group.key}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <MicroLabel>{group.label}</MicroLabel>
            {group.caption && (
              <MicroLabel className="text-[9px] text-text-dim">{group.caption}</MicroLabel>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {group.items.map((c) => (
              <EmailRow
                key={c.id}
                campaign={c}
                active={c.id === campaignId}
                onClick={() => navigate(channelPath('email', c.id))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const preview = selected ? (
    <PreviewShell campaign={selected} kind="email" onBack={() => navigate(ROUTES.email)}>
      <EmailPreview content={selected.email.content} />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select a send to preview the newsletter." />
  )

  return (
    <div>
      <PageHeader
        eyebrow="03"
        title="Email"
        subtitle="The weekly newsletter rhythm. Click a send to preview it as it lands."
      />
      <SplitLayout list={list} preview={preview} hasSelection={!!selected} />
    </div>
  )
}
