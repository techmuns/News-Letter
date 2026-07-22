import { Outlet, useLocation } from 'react-router-dom'
import { ProductMark } from './ProductMark'
import { NAV_ITEMS, RailItem, BottomNavItem } from './nav'
import { MicroLabel } from './MicroLabel'
import { IconBell, IconCrown, IconChevronDown } from './icons'

/** Display name of the current user (mock shell — a single seeded user). */
const USER_NAME = 'Neha'
const USER_INITIAL = 'N'

/** Resolve the active space label for the header title. */
function useSpaceTitle(): string {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((i) =>
    i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`),
  )
  return item?.label ?? 'Workspace'
}

function Avatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={
        'grid shrink-0 place-items-center rounded-full border border-[rgba(145,71,245,0.4)] bg-purple-soft font-display font-bold text-violet ' +
        (size === 'sm' ? 'h-8 w-8 text-[12px]' : 'h-9 w-9 text-[13px]')
      }
    >
      {USER_INITIAL}
    </span>
  )
}

function UpgradeButton() {
  return (
    <button
      type="button"
      className="hidden items-center gap-2 rounded-full border border-[rgba(217,145,77,0.35)] bg-[rgba(217,145,77,0.08)] px-3.5 py-2 text-[13px] font-medium text-text-2 transition-colors hover:bg-[rgba(217,145,77,0.14)] hover:text-text focus-violet sm:inline-flex"
    >
      <IconCrown size={15} className="text-orange" />
      Upgrade Plan
    </button>
  )
}

function TopBar({ title }: { title: string }) {
  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg px-5 md:px-8">
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <ProductMark compact />
        </div>
        <h1 className="font-display text-[19px] font-semibold tracking-tight text-text">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2.5 md:gap-3">
        <UpgradeButton />
        <button
          type="button"
          aria-label="Notifications"
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-muted transition-colors hover:border-border-strong hover:text-text focus-violet"
        >
          <IconBell size={17} />
        </button>
        <Avatar />
      </div>
    </header>
  )
}

function UserProfile() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:bg-surface-hover">
      <Avatar size="sm" />
      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">{USER_NAME}</p>
      <IconChevronDown size={15} className="shrink-0 text-text-dim" />
    </div>
  )
}

function LeftRail() {
  return (
    <aside className="hidden h-screen w-[266px] shrink-0 flex-col border-r border-border bg-rail md:flex">
      <div className="px-5 pb-2 pt-6">
        <ProductMark />
      </div>

      <div className="mt-7 px-6">
        <MicroLabel className="text-text-dim">Spaces</MicroLabel>
      </div>
      <nav className="mt-3 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <RailItem key={item.to} item={item} />
        ))}
      </nav>

      <div className="mt-auto border-t border-border-soft px-3 pb-4 pt-4">
        <UserProfile />
      </div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-rail md:hidden">
      {NAV_ITEMS.map((item) => (
        <BottomNavItem key={item.to} item={item} />
      ))}
    </nav>
  )
}

export function AppShell() {
  const title = useSpaceTitle()
  return (
    <div className="flex h-screen overflow-hidden">
      <LeftRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-7 md:px-9 md:pb-10 md:pt-8">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
