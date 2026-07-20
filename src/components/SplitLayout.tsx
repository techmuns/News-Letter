import { cn } from '../lib/cn'

/**
 * Master-detail layout: list + preview side by side on desktop; on mobile,
 * the preview replaces the list when something is selected.
 */
export function SplitLayout({
  list,
  preview,
  hasSelection,
}: {
  list: React.ReactNode
  preview: React.ReactNode
  hasSelection: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[350px_1fr]">
      <div className={cn('min-w-0', hasSelection && 'hidden lg:block')}>{list}</div>
      <div className={cn('min-w-0', !hasSelection && 'hidden lg:block')}>{preview}</div>
    </div>
  )
}

export function PreviewEmpty({ label }: { label: string }) {
  return (
    <div className="grid min-h-[300px] place-items-center rounded-panel border border-dashed border-border p-8 text-center">
      <div>
        <span className="mx-auto mb-3 block h-2 w-2 rounded-full bg-violet-dim" />
        <p className="text-[13px] text-text-muted">{label}</p>
      </div>
    </div>
  )
}
