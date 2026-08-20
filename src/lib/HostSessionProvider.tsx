import { createContext, useContext, type ReactNode } from 'react'
import { useHostContext, type HostContextValue } from '../hooks/useHostContext'

const HostSessionContext = createContext<HostContextValue | null>(null)

/** Mount once, above the router — everything below reads the same host
    session via `useHostSession()` instead of re-subscribing to the SDK. */
export function HostSessionProvider({ children }: { children: ReactNode }) {
  const value = useHostContext()
  return <HostSessionContext.Provider value={value}>{children}</HostSessionContext.Provider>
}

export function useHostSession(): HostContextValue {
  const ctx = useContext(HostSessionContext)
  if (!ctx) throw new Error('useHostSession must be used within a HostSessionProvider')
  return ctx
}
