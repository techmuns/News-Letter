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

/**
 * Desktop left-rail nav item. The rail is plum in both themes, so these
 * colours come from the --rail-* scale, not the page scale — the selected
 * item is a translucent lilac surface with a lilac accent.
 */
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
            ? 'rail-active'
            : 'border border-transparent text-rail-text-2 hover:bg-rail-hover hover:text-rail-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'micro w-5 shrink-0 text-center text-[10px]',
              isActive ? 'text-rail-accent' : 'text-rail-text-dim',
            )}
          >
            {item.n}
          </span>
          <Icon
            size={18}
            className={cn(isActive ? 'text-rail-accent' : 'text-rail-text-2')}
          />
          <span className="text-[14px] font-medium">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Mobile bottom-nav item — same plum ground, same lilac accent. */
export function BottomNavItem({ item }: { item: NavItem }) {
  const { Icon } = item
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200',
          isActive ? 'text-rail-accent' : 'text-rail-text-2',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} className={isActive ? 'text-rail-accent' : 'text-rail-text-2'} />
          <span className="micro text-[9px]">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}
