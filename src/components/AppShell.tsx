import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '../lib/cn'
import { ProductMark } from './ProductMark'
import { NAV_ITEMS, RailItem, BottomNavItem } from './nav'
import { MicroLabel } from './MicroLabel'
import { IconBell, IconCrown, IconChevronDown } from './icons'
import { ThemeToggle } from './ThemeToggle'

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

/**
 * The decorative background — large, static, heavily blurred plum and lilac
 * forms. Fixed behind everything and non-interactive; content sits above via
 * its own stacking context.
 */
function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden>
      <span className="blur-orb blur-orb-a" />
      <span className="blur-orb blur-orb-b" />
      <span className="blur-orb blur-orb-c" />
    </div>
  )
}

/** `onRail` switches the avatar to the lilac-on-plum palette of the sidebar. */
function Avatar({ size = 'md', onRail = false }: { size?: 'sm' | 'md'; onRail?: boolean }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full border font-display font-bold',
        onRail
          ? 'border-[color:var(--rail-active-border)] bg-rail-active text-rail-accent'
          : 'border-[color:var(--glow)] bg-purple-soft text-violet',
        size === 'sm' ? 'h-8 w-8 text-[12px]' : 'h-9 w-9 text-[13px]',
      )}
    >
      {USER_INITIAL}
    </span>
  )
}

function UpgradeButton() {
  return (
    <button
      type="button"
      className="hidden items-center gap-2 rounded-full border border-[color:var(--border)] bg-purple-soft px-3.5 py-2 text-[13px] font-medium text-violet transition-all duration-[350ms] ease-premium hover:border-border-strong hover:shadow-accent focus-violet sm:inline-flex"
    >
      <IconCrown size={15} className="text-violet" />
      Upgrade Plan
    </button>
  )
}

function TopBar({ title }: { title: string }) {
  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg-translucent px-5 backdrop-blur-glass md:px-8">
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
        <ThemeToggle />
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
    <div className="flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:bg-rail-hover">
      <Avatar size="sm" onRail />
      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-rail-text">
        {USER_NAME}
      </p>
      <IconChevronDown size={15} className="shrink-0 text-rail-text-dim" />
    </div>
  )
}

/** The sidebar — rich plum in both themes, lilac for accents and selection. */
function LeftRail() {
  return (
    <aside className="hidden h-screen w-[266px] shrink-0 flex-col border-r border-[color:var(--rail-border)] bg-rail bg-rail-gradient md:flex">
      <div className="px-5 pb-2 pt-6">
        <ProductMark onRail />
      </div>

      <div className="mt-7 px-6">
        <MicroLabel className="text-rail-text-dim">Spaces</MicroLabel>
      </div>
      <nav className="mt-3 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <RailItem key={item.to} item={item} />
        ))}
      </nav>

      <div className="mt-auto border-t border-[color:var(--rail-border)] px-3 pb-4 pt-4">
        <UserProfile />
      </div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[color:var(--rail-border)] bg-rail bg-rail-gradient md:hidden">
      {NAV_ITEMS.map((item) => (
        <BottomNavItem key={item.to} item={item} />
      ))}
    </nav>
  )
}

export function AppShell() {
  const title = useSpaceTitle()
  return (
    <>
      <Atmosphere />
      {/* isolate keeps app chrome above the fixed decorative layer */}
      <div className="relative isolate flex h-screen overflow-hidden">
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
    </>
  )
}
