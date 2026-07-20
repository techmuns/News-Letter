import { cn } from '../lib/cn'

/** A shimmering placeholder line/block for mocked loading states (§5.6). */
export function Skeleton({
  className,
  rounded = 'rounded-md',
}: {
  className?: string
  rounded?: string
}) {
  return <div className={cn('shimmer', rounded, className)} />
}

/** A few stacked shimmer lines, for a "generating draft" state. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
