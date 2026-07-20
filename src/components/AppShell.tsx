import { Outlet } from 'react-router-dom'
import { ProductMark } from './ProductMark'
import { NAV_ITEMS, RailItem, BottomNavItem } from './nav'
import { MicroLabel } from './MicroLabel'

function UserChip() {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border pl-1 pr-3 py-1">
      <span className="grid h-7 w-7 place-items-center rounded-full border border-[rgba(170,152,248,0.35)] bg-[rgba(170,152,248,0.16)] font-display text-[12px] font-bold text-violet">
        N
      </span>
      <span className="hidden text-[12.5px] font-medium text-text-2 sm:inline">Neha</span>
    </div>
  )
}

function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border-strong bg-[rgba(39,34,54,0.72)] px-4 backdrop-blur-glass md:px-7">
      <div className="md:hidden">
        <ProductMark compact />
      </div>
      <div className="hidden md:block">
        <MicroLabel className="text-text-dim">Internal · mock preview</MicroLabel>
      </div>
      <UserChip />
    </header>
  )
}

function LeftRail() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border-strong bg-[var(--rail)] px-4 py-5 md:flex">
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
    </aside>
  )
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-[rgba(39,34,54,0.93)] backdrop-blur-glass md:hidden">
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
          <div className="mx-auto w-full max-w-[1120px]">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
