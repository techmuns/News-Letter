import { useStore } from '../store/useStore'
import { PageHeader } from '../components/PageHeader'
import { CampaignsRail } from '../components/workspace/CampaignsRail'

export function CampaignsSpace() {
  const campaigns = useStore((s) => s.campaigns)
  return (
    <div>
      <PageHeader
        eyebrow="06"
        title="Campaigns"
        subtitle="Every campaign generated from the workspace, with its three linked channels. Review and approve each one before it distributes to its space."
      />
      <div className="max-w-[620px]">
        <CampaignsRail campaigns={campaigns} showHeading={false} />
      </div>
    </div>
  )
}
