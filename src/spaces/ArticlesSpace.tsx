import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { ROUTES, channelPath } from '../lib/routes'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { SplitLayout, PreviewEmpty } from '../components/SplitLayout'
import { ChannelListRow } from '../components/ChannelListRow'
import { PreviewShell } from '../components/preview/PreviewShell'
import { ArticlePreview } from '../components/preview/ArticlePreview'

export function ArticlesSpace() {
  const campaigns = useStore((s) => s.campaigns)
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const selected = campaigns.find((c) => c.id === campaignId) ?? null

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>{campaigns.length} articles</MicroLabel>
      {campaigns.map((c) => (
        <ChannelListRow
          key={c.id}
          campaign={c}
          kind="article"
          active={c.id === campaignId}
          snippet={c.article.content.deck}
          onClick={() => navigate(channelPath('article', c.id))}
        />
      ))}
    </div>
  )

  const preview = selected ? (
    <PreviewShell campaign={selected} kind="article" onBack={() => navigate(ROUTES.articles)}>
      <ArticlePreview content={selected.article.content} promo={selected.promo} />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select an article to preview the long-form draft." />
  )

  return (
    <div>
      <PageHeader
        eyebrow="04 · Articles"
        title="Long-form articles"
        subtitle="The deep version of each campaign — one idea, worked through, ending in a relevant Munshot pointer."
      />
      <SplitLayout list={list} preview={preview} hasSelection={!!selected} />
    </div>
  )
}
