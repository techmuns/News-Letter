import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { ROUTES, channelPath } from '../lib/routes'
import { useMediaQuery } from '../lib/useMediaQuery'
import { channelApproved } from '../types'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { SplitLayout, PreviewEmpty } from '../components/SplitLayout'
import { ChannelListRow } from '../components/ChannelListRow'
import { PreviewShell } from '../components/preview/PreviewShell'
import { LinkedInPost } from '../components/preview/LinkedInPost'

function firstLine(s: string): string {
  return s.split('\n')[0]
}

export function LinkedInSpace() {
  const campaigns = useStore((s) => s.campaigns).filter((c) => channelApproved(c.linkedin))
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const selected = campaigns.find((c) => c.id === campaignId) ?? null
  // On desktop, default the preview to the first draft so the panel is never empty.
  const previewCampaign = selected ?? (isDesktop ? campaigns[0] ?? null : null)

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>Drafts</MicroLabel>
      {campaigns.map((c) => (
        <ChannelListRow
          key={c.id}
          campaign={c}
          kind="linkedin"
          active={c.id === previewCampaign?.id}
          snippet={firstLine(c.linkedin.content.body)}
          onClick={() => navigate(channelPath('linkedin', c.id))}
        />
      ))}
    </div>
  )

  const preview = previewCampaign ? (
    <PreviewShell campaign={previewCampaign} kind="linkedin" onBack={() => navigate(ROUTES.linkedin)}>
      <LinkedInPost
        content={previewCampaign.linkedin.content}
        image={previewCampaign.heroImage}
        topic={previewCampaign.topic}
      />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select a post to preview how it will look on LinkedIn." />
  )

  return (
    <div>
      <PageHeader
        eyebrow="02"
        title="LinkedIn"
        subtitle="One post per campaign. Click a draft to preview how it reads in-feed."
      />
      <SplitLayout list={list} preview={preview} hasSelection={!!selected} />
    </div>
  )
}
