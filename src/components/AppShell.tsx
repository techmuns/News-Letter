import { Outlet } from 'react-router-dom'
import { ProductMark } from './ProductMark'
import { NAV_ITEMS, RailItem, BottomNavItem } from './nav'
import { MicroLabel } from './MicroLabel'
import { StatusDot } from './StatusDot'
import { useStore } from '../store/useStore'

function UserChip() {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border pl-1 pr-3 py-1">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[rgba(157,140,245,0.14)] border border-[rgba(157,140,245,0.3)] font-display font-bold text-[12px] text-violet">
        N
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[12.5px] text-text-2 font-medium">Neha</span>
        <MicroLabel className="mt-0.5 text-[9px]">Team member</MicroLabel>
      </span>
    </div>
  )
}

function TopBar() {
  const campaignCount = useStore((s) => s.campaigns.length)
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-[rgba(10,9,18,0.72)] px-4 backdrop-blur-glass md:px-7">
      {/* mobile: product mark. desktop: live system line */}
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <ProductMark compact />
        </div>
        <div className="hidden items-center gap-2.5 md:flex">
          <StatusDot tone="green" size={7} />
          <MicroLabel>System online</MicroLabel>
          <span className="text-text-dim">·</span>
          <MicroLabel>{campaignCount} campaigns linked</MicroLabel>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden rounded-full border border-[rgba(245,194,75,0.28)] px-2.5 py-1 sm:inline-block">
          <MicroLabel className="text-amber text-[9px]">Phase 1 · mock data</MicroLabel>
        </span>
        <UserChip />
      </div>
    </header>
  )
}

function LeftRail() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border px-4 py-5 md:flex">
      <div className="px-2">
        <ProductMark />
      </div>

      <div className="mt-8 px-2">
        <MicroLabel>Spaces</MicroLabel>
      </div>
      <nav className="mt-3 flex flex-col gap-1.5">
        {NAV_ITEMS.map((item) => (
          <RailItem key={item.to} item={item} />
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-border p-3">
        <MicroLabel className="micro-violet">The mechanic</MicroLabel>
        <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
          One master item → three linked channel versions. Each edits and ships on its own.
        </p>
      </div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-[rgba(10,9,18,0.9)] backdrop-blur-glass md:hidden">
      {NAV_ITEMS.map((item) => (
        <BottomNavItem key={item.to} item={item} />
      ))}
    </nav>
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <LeftRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 pb-24 pt-6 md:px-7 md:pb-10 md:pt-8">
          <div className="mx-auto w-full max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
