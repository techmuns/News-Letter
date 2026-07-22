import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { ROUTES, previewPath } from '../lib/routes'
import { useMediaQuery } from '../lib/useMediaQuery'
import { cn } from '../lib/cn'
import { relativeTime } from '../lib/date'
import {
  type Campaign,
  type ChannelKind,
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  campaignNeedsReview,
  statusTone,
} from '../types'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { Card } from '../components/Card'
import { SplitLayout, PreviewEmpty } from '../components/SplitLayout'
import { ChannelChips } from '../components/ChannelChips'
import { StatusDot } from '../components/StatusDot'
import { ChannelIcon } from '../components/icons'
import { PreviewShell } from '../components/preview/PreviewShell'
import { LinkedInPost } from '../components/preview/LinkedInPost'
import { EmailPreview } from '../components/preview/EmailPreview'
import { ArticlePreview } from '../components/preview/ArticlePreview'

function CampaignListRow({
  campaign,
  active,
  onClick,
}: {
  campaign: Campaign
  active: boolean
  onClick: () => void
}) {
  const needsReview = campaignNeedsReview(campaign)
  return (
    <Card active={active} interactive onClick={onClick} className="p-4">
      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-text">{campaign.name}</p>
      <p className="mt-1 line-clamp-1 text-[12.5px] text-text-muted">{campaign.topic}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <ChannelChips campaign={campaign} />
        {needsReview ? (
          <MicroLabel className="text-[9.5px] text-amber">Needs review</MicroLabel>
        ) : (
          <MicroLabel className="text-[9.5px]">{relativeTime(campaign.createdAt)}</MicroLabel>
        )}
      </div>
    </Card>
  )
}

function ChannelTabs({
  campaign,
  available,
  active,
  onSelect,
}: {
  campaign: Campaign
  available: ChannelKind[]
  active: ChannelKind
  onSelect: (kind: ChannelKind) => void
}) {
  return (
    <div className="mb-5 flex items-center gap-1.5 rounded-xl border border-border p-1.5">
      {available.map((kind) => {
        const ch = campaign[kind]
        const isActive = kind === active
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(kind)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium',
              'transition-all duration-[350ms] ease-premium',
              isActive ? 'glow-active text-text' : 'text-text-muted hover:text-text-2',
            )}
          >
            <ChannelIcon kind={kind} size={15} />
            {CHANNEL_LABEL[kind]}
            <StatusDot tone={statusTone(ch.status)} size={6} />
          </button>
        )
      })}
    </div>
  )
}

function ChannelBody({ campaign, kind }: { campaign: Campaign; kind: ChannelKind }) {
  if (kind === 'linkedin') {
    return (
      <LinkedInPost content={campaign.linkedin.content} image={campaign.heroImage} topic={campaign.topic} />
    )
  }
  if (kind === 'email') return <EmailPreview content={campaign.email.content} />
  return <ArticlePreview content={campaign.article.content} promo={campaign.promo} image={campaign.heroImage} />
}

export function PreviewSpace() {
  // Every campaign is previewable here — including ones still awaiting review,
  // which is where they now get approved (skip only the brief processing beat).
  const campaigns = useStore((s) => s.campaigns).filter((c) => !c.processing)
  const { campaignId, channel } = useParams()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const selected = campaigns.find((c) => c.id === campaignId) ?? null
  // On desktop, default the preview to the first campaign so the panel is never empty.
  const previewCampaign = selected ?? (isDesktop ? campaigns[0] ?? null : null)

  // All three channels are always shown as tabs so each can be reviewed in place.
  const availableKinds = CHANNEL_ORDER
  const requestedKind = channel as ChannelKind | undefined
  const activeKind: ChannelKind | null = previewCampaign
    ? requestedKind && availableKinds.includes(requestedKind)
      ? requestedKind
      : availableKinds[0]
    : null

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>Campaigns</MicroLabel>
      {campaigns.map((c) => (
        <CampaignListRow
          key={c.id}
          campaign={c}
          active={c.id === previewCampaign?.id}
          onClick={() => navigate(previewPath(c.id))}
        />
      ))}
    </div>
  )

  const preview =
    previewCampaign && activeKind ? (
      <div>
        <ChannelTabs
          campaign={previewCampaign}
          available={availableKinds}
          active={activeKind}
          onSelect={(kind) => navigate(previewPath(previewCampaign.id, kind), { replace: true })}
        />
        <PreviewShell campaign={previewCampaign} kind={activeKind} onBack={() => navigate(ROUTES.preview)}>
          <ChannelBody campaign={previewCampaign} kind={activeKind} />
        </PreviewShell>
      </div>
    ) : (
      <PreviewEmpty label="Select a campaign to preview LinkedIn, Email and Article together." />
    )

  return (
    <div>
      <PageHeader
        eyebrow="02"
        title="Preview"
        subtitle="Every channel version of a campaign in one place — flip between LinkedIn, Email and Article without leaving the page."
      />
      <SplitLayout list={list} preview={preview} hasSelection={!!selected} />
    </div>
  )
}
