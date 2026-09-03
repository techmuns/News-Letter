import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { channelApproved } from '../../types'
import { MicroLabel } from '../../components/MicroLabel'
import { SplitLayout, PreviewEmpty } from '../../components/SplitLayout'
import { ChannelListRow } from '../../components/ChannelListRow'
import { PreviewShell } from '../../components/preview/PreviewShell'
import { LinkedInPost } from '../../components/preview/LinkedInPost'
import { BufferConnectCard } from '../../components/channels/BufferConnectCard'

function firstLine(s: string): string {
  return s.split('\n')[0]
}

/** LinkedIn history — the generated posts, as they read in-feed. */
export function LinkedInPanel() {
  const campaigns = useStore((s) => s.campaigns).filter((c) => channelApproved(c.linkedin))
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const previewCampaign =
    campaigns.find((c) => c.id === selectedId) ?? (isDesktop ? campaigns[0] ?? null : null)

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>Drafts</MicroLabel>
      {campaigns.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] leading-relaxed text-text-muted">
          No LinkedIn posts yet. Generate one in <strong>Studio</strong> or{' '}
          <strong>Daily Pulse</strong> — it lands here and marks Published when you publish.
        </p>
      )}
      {campaigns.map((c) => (
        <ChannelListRow
          key={c.id}
          campaign={c}
          kind="linkedin"
          active={c.id === previewCampaign?.id}
          snippet={firstLine(c.linkedin.content.body)}
          onClick={() => setSelectedId(c.id)}
        />
      ))}
    </div>
  )

  const preview = previewCampaign ? (
    <PreviewShell campaign={previewCampaign} kind="linkedin" onBack={() => setSelectedId(null)}>
      <LinkedInPost
        content={previewCampaign.linkedin.content}
        image={previewCampaign.heroImage}
        topic={previewCampaign.topic}
        // heroImage is already a fully rendered branded card (Studio and
        // Daily Pulse both produce one). Without this the preview draws the
        // branding template over it a second time — two brand marks and a
        // ghosted duplicate headline.
        plainImage
      />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select a post to preview how it will look on LinkedIn." />
  )

  return (
    <div className="flex flex-col gap-5">
      <BufferConnectCard />
      <SplitLayout list={list} preview={preview} hasSelection={!!selectedId} />
    </div>
  )
}
