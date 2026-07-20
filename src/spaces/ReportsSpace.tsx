import { PageHeader } from '../components/PageHeader'
import { IconReports } from '../components/icons'

export function ReportsSpace() {
  return (
    <div>
      <PageHeader
        eyebrow="05"
        title="Reports"
        subtitle="Performance across your published content — reach, engagement and campaign outcomes."
      />
      <div className="rounded-panel border border-border bg-surface p-12 text-center shadow-panel">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-purple-soft">
          <IconReports size={22} className="text-violet" />
        </span>
        <p className="mx-auto mt-4 max-w-[40ch] text-[14px] font-medium text-text-2">
          No reports yet
        </p>
        <p className="mx-auto mt-1.5 max-w-[44ch] text-[13px] leading-relaxed text-text-muted">
          Publish content from your channels and its performance will be summarised here.
        </p>
      </div>
    </div>
  )
}
