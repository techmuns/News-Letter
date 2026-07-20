import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { ROUTES, channelPath } from '../lib/routes'
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
  const campaigns = useStore((s) => s.campaigns)
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const selected = campaigns.find((c) => c.id === campaignId) ?? null

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>Drafts</MicroLabel>
      {campaigns.map((c) => (
        <ChannelListRow
          key={c.id}
          campaign={c}
          kind="linkedin"
          active={c.id === campaignId}
          snippet={firstLine(c.linkedin.content.body)}
          onClick={() => navigate(channelPath('linkedin', c.id))}
        />
      ))}
    </div>
  )

  const preview = selected ? (
    <PreviewShell campaign={selected} kind="linkedin" onBack={() => navigate(ROUTES.linkedin)}>
      <LinkedInPost content={selected.linkedin.content} />
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
