import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type PulseItem, type StockResult } from '../../lib/api'
import { IconSparkle } from '../../components/icons'
import { cn } from '../../lib/cn'

export interface FocusGroup {
  label: string
  items: PulseItem[]
}

/** A professional focus picker: click to open a styled, grouped dropdown of
    tracked instruments — or search the live company database (Munshot) and pick
    any listed stock, which routes to a news-grounded post. Replaces the unstyled
    native <datalist>. */
export function FocusCombobox({
  value,
  onChange,
  groups,
  placeholder = 'Auto — whole-market wrap',
}: {
  value: string
  onChange: (v: string) => void
  groups: FocusGroup[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState<StockResult[]>([])
  const [searching, setSearching] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 20)
  }, [open])

  const trimmed = query.trim()
  const q = trimmed.toLowerCase()

  // debounced live company search
  useEffect(() => {
    if (trimmed.length < 2) {
      setStocks([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      api
        .stockSearch(trimmed)
        .then((r) => {
          if (!cancelled) {
            setStocks(r.results || [])
            setSearching(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStocks([])
            setSearching(false)
          }
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [trimmed])

  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (it) =>
              !q || it.name.toLowerCase().includes(q) || it.ticker.toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.items.length),
    [groups, q],
  )
  const exactMatch = useMemo(
    () => groups.some((g) => g.items.some((it) => it.name.toLowerCase() === q)),
    [groups, q],
  )

  function pick(v: string) {
    onChange(v)
    setQuery('')
    setStocks([])
    setOpen(false)
  }

  const showFreeText = trimmed.length >= 2 && !exactMatch && !searching && stocks.length === 0

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-left text-[14px] transition-colors',
          open ? 'border-glow shadow-glow' : 'border-border hover:border-border-strong',
        )}
      >
        <span className={cn('truncate', value ? 'text-text' : 'text-text-dim')}>
          {value || placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className={cn('shrink-0 text-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-border-strong bg-surface-solid shadow-[0_20px_50px_-16px_rgba(0,0,0,0.75)]">
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed && !exactMatch && stocks.length === 0) {
                  e.preventDefault()
                  pick(trimmed)
                }
              }}
              placeholder="Search any company or instrument…"
              className="w-full rounded-md border border-border bg-[rgba(255,255,255,0.02)] px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-dim focus:outline-none focus-violet"
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            {!trimmed && (
              <button
                type="button"
                onClick={() => pick('')}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-[rgba(255,255,255,0.04)]',
                  !value ? 'text-violet' : 'text-text-2',
                )}
              >
                Auto — whole-market wrap
              </button>
            )}

            {/* tracked instruments (live market data) */}
            {filtered.map((g) => (
              <div key={g.label} className="py-0.5">
                <div className="micro px-3 pb-1 pt-1.5 text-text-dim">{g.label}</div>
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => pick(it.name)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13.5px] transition-colors hover:bg-[rgba(255,255,255,0.04)]',
                      value.toLowerCase() === it.name.toLowerCase() ? 'text-violet' : 'text-text-2',
                    )}
                  >
                    <span className="truncate">{it.name}</span>
                    {it.ticker && <span className="shrink-0 font-mono text-[11px] text-text-dim">{it.ticker}</span>}
                  </button>
                ))}
              </div>
            ))}

            {/* live company search */}
            {trimmed.length >= 2 && (
              <div className="py-0.5">
                <div className="micro flex items-center gap-2 px-3 pb-1 pt-1.5 text-text-dim">
                  Companies
                  {searching && <span className="text-text-dim">· searching…</span>}
                </div>
                {stocks.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => pick(s.name)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-text-2">{s.name}</span>
                      <span className="block truncate text-[11px] text-text-dim">
                        {[s.country, s.sector].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-text-dim">{s.symbol}</span>
                  </button>
                ))}
                {!searching && stocks.length === 0 && !exactMatch && (
                  <p className="px-3 py-1 text-[11.5px] text-text-dim">No matching companies.</p>
                )}
              </div>
            )}

            {/* free-text fallback → news-grounded post */}
            {showFreeText && (
              <button
                type="button"
                onClick={() => pick(trimmed)}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-[13px] text-violet transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                <IconSparkle size={14} />
                <span className="truncate">Generate a news post for “{trimmed}”</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
