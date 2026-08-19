import { useEffect, useRef, useState } from 'react'
import { ALLOWED_HOST_ORIGINS, sdk, type DashboardSdkEnvelope, type SessionContext } from '../lib/sdk'
import { isTrustedOrigin, isValidSessionPayload } from '../lib/hostMessageGuard'

const EMPTY_SESSION: SessionContext = {
  token: null,
  userName: null,
  email: null,
  orgId: null,
  orgName: null,
}

/** Standalone / not-embedded fallback identity — never carries a real token. */
export const GUEST_SESSION: SessionContext = {
  token: null,
  userName: 'Guest',
  email: null,
  orgId: null,
  orgName: null,
}

/** How long to wait for `host:init` before falling back to guest, when framed. */
const GUEST_FALLBACK_DELAY_MS = 1500

export type HostSessionStatus = 'waiting' | 'host' | 'guest'

export interface HostContextValue {
  session: SessionContext
  status: HostSessionStatus
}

/**
 * Centralizes host-session access: reads the SDK's cached context on mount,
 * subscribes to later updates, and independently re-verifies origin + payload
 * shape on every message (the vendor SDK's own origin check happens before
 * this code ever runs, so it isn't a substitute for this check).
 *
 * When the app isn't embedded in the Munshot host — or is embedded but no
 * session arrives within the grace period — it falls back to a local "Guest"
 * identity instead of hanging on a waiting state forever. A real host session
 * that arrives later always overrides the guest fallback.
 */
export function useHostContext(): HostContextValue {
  const [session, setSession] = useState<SessionContext>(EMPTY_SESSION)
  const [status, setStatus] = useState<HostSessionStatus>('waiting')
  const receivedHostSession = useRef(false)

  useEffect(() => {
    const applySession = (raw: unknown) => {
      if (!isValidSessionPayload(raw)) {
        console.warn('[dashboard] Ignoring malformed host session payload')
        return
      }
      receivedHostSession.current = true
      setStatus('host')
      setSession((prev) => {
        const next = { ...EMPTY_SESSION, ...raw }
        const unchanged =
          prev.token === next.token &&
          prev.userName === next.userName &&
          prev.email === next.email &&
          prev.orgId === next.orgId &&
          prev.orgName === next.orgName
        return unchanged ? prev : next // stable reference => no re-render storm
      })
    }

    // 1. Already-cached context: host:init may have arrived (and been origin-
    //    checked by the SDK) before this hook mounted, so there is no
    //    MessageEvent left to re-validate on this side of the SDK boundary.
    const cached = sdk.getContext()
    if (cached?.session) applySession(cached.session)

    // 2. Every later message DOES carry its origin — re-verify independently.
    const unsubscribe = sdk.onMessage((envelope: DashboardSdkEnvelope, meta: { origin: string }) => {
      if (!isTrustedOrigin(meta.origin, ALLOWED_HOST_ORIGINS)) {
        console.warn('[dashboard] Ignoring postMessage from untrusted origin:', meta.origin)
        return
      }
      if (envelope.source !== 'host') return
      const ctx = sdk.getContext()
      if (ctx?.session) applySession(ctx.session)
    })

    const embedded = window.self !== window.top
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    if (!embedded) {
      // No host to wait for — sign in as guest immediately.
      if (!receivedHostSession.current) {
        setStatus('guest')
        setSession(GUEST_SESSION)
      }
    } else {
      fallbackTimer = setTimeout(() => {
        if (!receivedHostSession.current) {
          setStatus('guest')
          setSession(GUEST_SESSION)
        }
      }, GUEST_FALLBACK_DELAY_MS)
    }

    return () => {
      unsubscribe()
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  return { session, status }
}
