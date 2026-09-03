import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { type Campaign, channelApproved } from '../../types'
import { api, type HealthFlags } from '../../lib/api'
import { MicroLabel } from '../../components/MicroLabel'
import { Button } from '../../components/Button'
import { IconSparkle } from '../../components/icons'
import { SplitLayout, PreviewEmpty } from '../../components/SplitLayout'
import { ChannelListRow } from '../../components/ChannelListRow'
import { PreviewShell } from '../../components/preview/PreviewShell'
import { ArticlePreview } from '../../components/preview/ArticlePreview'

/** Article history — a long-form draft per generation, on-demand upgradable to
    a full AI-written piece. */
export function ArticlesPanel() {
  const campaigns = useStore((s) => s.campaigns).filter((c) => channelApproved(c.article))
  const setArticleContent = useStore((s) => s.setArticleContent)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const removeCampaign = useStore((s) => s.removeCampaign)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const previewCampaign =
    campaigns.find((c) => c.id === selectedId) ?? (isDesktop ? campaigns[0] ?? null : null)

  const [health, setHealth] = useState<HealthFlags | null>(null)
  const [writingId, setWritingId] = useState<string | null>(null)
  const [writeErr, setWriteErr] = useState('')
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  async function writeFullArticle(c: Campaign) {
    setWritingId(c.id)
    setWriteErr('')
    try {
      const { article } = await api.generateArticle({
        title: c.name,
        topic: c.topic,
        linkedin: c.linkedin.content.body,
        email: {
          subject: c.email.content.subject,
          idea: c.email.content.idea,
          story: c.email.content.story,
          takeaway: c.email.content.takeaway,
        },
      })
      setArticleContent(c.id, article)
    } catch (e) {
      setWriteErr((e as Error).message)
    } finally {
      setWritingId(null)
    }
  }

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>Drafts</MicroLabel>
      {campaigns.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] leading-relaxed text-text-muted">
          No articles yet. Each post you generate in <strong>Studio</strong> or{' '}
          <strong>Daily Pulse</strong> gets a long-form draft here, built from the same source.
        </p>
      )}
      {campaigns.map((c) => (
        <ChannelListRow
          key={c.id}
          campaign={c}
          kind="article"
          active={c.id === previewCampaign?.id}
          snippet={c.article.content.deck}
          onClick={() => setSelectedId(c.id)}
          onDelete={() => {
            removeCampaign(c.id)
            if (selectedId === c.id) setSelectedId(null)
          }}
        />
      ))}
    </div>
  )

  const preview = previewCampaign ? (
    <PreviewShell campaign={previewCampaign} kind="article" onBack={() => setSelectedId(null)}>
      {!previewCampaign.article.edited && (
        <div className="mb-4 rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-text-muted">
              Quick draft assembled from your post + email. Turn it into a full, AI-written long-form
              article.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => writeFullArticle(previewCampaign)}
              disabled={writingId === previewCampaign.id || (!!health && !health.ai)}
            >
              <IconSparkle size={15} />
              {writingId === previewCampaign.id ? 'Writing…' : 'Write the full article'}
            </Button>
          </div>
          {writeErr && <p className="mt-2 text-[11.5px] text-[#f7a3a3]">{writeErr}</p>}
        </div>
      )}
      <ArticlePreview
        content={previewCampaign.article.content}
        promo={previewCampaign.promo}
        image={previewCampaign.heroImage}
      />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select an article to preview the long-form draft." />
  )

  return <SplitLayout list={list} preview={preview} hasSelection={!!selectedId} />
}
