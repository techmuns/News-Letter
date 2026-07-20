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
import { ArticlePreview } from '../components/preview/ArticlePreview'

export function ArticlesSpace() {
  const campaigns = useStore((s) => s.campaigns).filter((c) => channelApproved(c.article))
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const selected = campaigns.find((c) => c.id === campaignId) ?? null
  const previewCampaign = selected ?? (isDesktop ? campaigns[0] ?? null : null)

  const list = (
    <div className="flex flex-col gap-3">
      <MicroLabel>Drafts</MicroLabel>
      {campaigns.map((c) => (
        <ChannelListRow
          key={c.id}
          campaign={c}
          kind="article"
          active={c.id === previewCampaign?.id}
          snippet={c.article.content.deck}
          onClick={() => navigate(channelPath('article', c.id))}
        />
      ))}
    </div>
  )

  const preview = previewCampaign ? (
    <PreviewShell campaign={previewCampaign} kind="article" onBack={() => navigate(ROUTES.articles)}>
      <ArticlePreview
        content={previewCampaign.article.content}
        promo={previewCampaign.promo}
        image={previewCampaign.heroImage}
      />
    </PreviewShell>
  ) : (
    <PreviewEmpty label="Select an article to preview the long-form draft." />
  )

  return (
    <div>
      <PageHeader
        eyebrow="04"
        title="Articles"
        subtitle="The long-form version of each campaign. Click to read the draft."
      />
      <SplitLayout list={list} preview={preview} hasSelection={!!selected} />
    </div>
  )
}
