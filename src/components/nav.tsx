import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'
import { ROUTES } from '../lib/routes'
import { IconWorkspace, IconEye, IconCalendar } from './icons'

export interface NavItem {
  n: string
  label: string
  to: string
  end?: boolean
  Icon: (props: { size?: number; className?: string }) => JSX.Element
}

export const NAV_ITEMS: NavItem[] = [
  { n: '01', label: 'Workspace', to: ROUTES.workspace, end: true, Icon: IconWorkspace },
  { n: '02', label: 'Preview', to: ROUTES.preview, Icon: IconEye },
  { n: '03', label: 'Scheduling', to: ROUTES.scheduling, Icon: IconCalendar },
]

/** Desktop left-rail nav item — active item gets the muted-violet glow chip. */
export function RailItem({ item }: { item: NavItem }) {
  const { Icon } = item
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5',
          'transition-all duration-[350ms] ease-premium',
          isActive
            ? 'glow-active text-text'
            : 'border border-transparent text-text-muted hover:text-text-2 hover:bg-surface-hover',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'micro w-5 shrink-0 text-center text-[10px]',
              isActive ? 'text-violet' : 'text-text-dim group-hover:text-text-muted',
            )}
          >
            {item.n}
          </span>
          <Icon
            size={18}
            className={cn(isActive ? 'text-violet' : 'text-text-muted group-hover:text-text-2')}
          />
          <span className="text-[14px] font-medium">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Mobile bottom-nav item. */
export function BottomNavItem({ item }: { item: NavItem }) {
  const { Icon } = item
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200',
          isActive ? 'text-violet' : 'text-text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} className={isActive ? 'text-violet' : 'text-text-muted'} />
          <span className="micro text-[9px]">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}
