/* The tracked-creators list lives client-side (localStorage) and is passed to
   the server on each creators-mode search — so no server storage/binding is
   needed. The leaderboard is discovered via /api/discover-creators. */
import { type Creator } from './api'

const LIST_KEY = 'munshot-tracked-creators'
const TS_KEY = 'munshot-creators-refreshed'

export function getTracked(): Creator[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((c) => c && c.handle) : []
  } catch {
    return []
  }
}

export function setTracked(list: Creator[]) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function isTracked(handle: string): boolean {
  return getTracked().some((c) => c.handle === handle)
}

/** Add or remove a creator; returns the new list. */
export function toggleTracked(c: Creator): Creator[] {
  const list = getTracked()
  const i = list.findIndex((x) => x.handle === c.handle)
  if (i >= 0) list.splice(i, 1)
  else list.push(c)
  setTracked(list)
  return list
}

/** Upsert many (used when a discovery run refreshes the leaderboard). */
export function upsertMany(cs: Creator[]): Creator[] {
  const byHandle = new Map(getTracked().map((c) => [c.handle, c]))
  for (const c of cs) byHandle.set(c.handle, c)
  const merged = [...byHandle.values()]
  setTracked(merged)
  return merged
}

export function trackedHandles(): string[] {
  return getTracked().map((c) => c.handle)
}

export function getRefreshedAt(): number {
  try {
    return Number(localStorage.getItem(TS_KEY)) || 0
  } catch {
    return 0
  }
}

export function markRefreshed(ts: number) {
  try {
    localStorage.setItem(TS_KEY, String(ts))
  } catch {
    /* ignore */
  }
}
