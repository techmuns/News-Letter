/* Munshot Dashboard SDK client — the single source of truth for host session
   (JWT + identity) and market/nav context. Constructed at import time so its
   message listener is live before the host's `host:init` can arrive; nothing
   else in the app should call `window.MunshotDashboardSDK` directly. */

export const DASHBOARD_ID = 'munshot-content-system'
export const DASHBOARD_NAME = 'Munshot Content System'

function parseOriginList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

/**
 * Exact scheme+host of every origin allowed to postMessage a session into
 * this app. Hardcoded (not just env-driven) so a build that forgets the env
 * var still fails closed to a real allow-list instead of an empty one — an
 * empty list is NOT safe here (see the allowedOrigins note in sdk config
 * below: the vendor SDK treats `allowedOrigins: []` as "not provided" and
 * falls back to accepting the first sender it sees).
 */
const DEFAULT_ALLOWED_HOST_ORIGINS = ['https://chat.muns.io']

const envOrigins = parseOriginList(import.meta.env.VITE_MUNSHOT_ALLOWED_ORIGINS as string | undefined)
export const ALLOWED_HOST_ORIGINS = envOrigins.length ? envOrigins : DEFAULT_ALLOWED_HOST_ORIGINS

export interface SessionContext {
  token: string | null
  userName: string | null
  email: string | null
  orgId: string | null
  orgName: string | null
}

export interface MarketContext {
  selectedTicker: string | null
  selectedTickerCompany: string | null
  selectedTickerCountry: string | null
  selectedSymbol: string | null
}

export interface DashboardHostContext {
  session?: SessionContext
  market?: MarketContext
  app?: {
    route: string | null
    query: string | null
    viewMode: string | null
    selectedCategory: string | null
    searchQuery: string | null
  }
}

export interface DashboardSdkEnvelope {
  namespace: string
  version: string
  channelId: string
  source: 'host' | 'dashboard'
  kind: string
  timestamp: number
  requestId?: string
  payload?: unknown
}

export interface DashboardClientSdk {
  getContext(): DashboardHostContext | null
  getChannelId(): string | null
  onMessage(h: (env: DashboardSdkEnvelope, meta: { origin: string }) => void): () => void
  onTopic(topic: string, h: (t: unknown, meta: unknown, env: DashboardSdkEnvelope) => void): () => void
  onRequest(
    topic: string,
    h: (t: unknown, meta: unknown, env: DashboardSdkEnvelope) => unknown | Promise<unknown>,
  ): () => void
  ready(): boolean
  requestContext(): boolean
  publish(topic: string, data?: unknown, metadata?: unknown): boolean
  request(topic: string, data?: unknown, options?: { timeoutMs?: number; metadata?: unknown }): Promise<unknown>
  sendError(message: string, code?: string, details?: unknown): boolean
  destroy(): void
}

interface CreateClientConfig {
  dashboardId: string
  dashboardName?: string
  autoReady?: boolean
  requestTimeoutMs?: number
  maxPayloadBytes?: number
  lockOriginOnFirstMessage?: boolean
  allowedOrigins?: string[]
  targetWindow?: Window | null
  targetOrigin?: string
}

declare global {
  interface Window {
    MunshotDashboardSDK?: {
      createDashboardClientSdk?: (c: CreateClientConfig) => DashboardClientSdk
      createClient?: (c: CreateClientConfig) => DashboardClientSdk
      DashboardClientSdk?: new (c: CreateClientConfig) => DashboardClientSdk
      Client?: new (c: CreateClientConfig) => DashboardClientSdk
    }
  }
}

/** Used only when the SDK script is absent (running standalone, outside the
    Munshot host). Return types match the real client so app code is identical. */
function createNoopSdk(): DashboardClientSdk {
  return {
    getContext: () => null,
    getChannelId: () => null,
    onMessage: () => () => {},
    onTopic: () => () => {},
    onRequest: () => () => {},
    ready: () => false,
    requestContext: () => false,
    publish: () => false,
    request: async () => null,
    sendError: () => false,
    destroy: () => {},
  }
}

function initSdk(): DashboardClientSdk {
  const g = window.MunshotDashboardSDK
  const config: CreateClientConfig = {
    dashboardId: DASHBOARD_ID,
    dashboardName: DASHBOARD_NAME,
    lockOriginOnFirstMessage: true,
    // Only spread when non-empty — an empty array is treated by the vendor
    // SDK as "not provided" and fails open, not closed.
    ...(ALLOWED_HOST_ORIGINS.length ? { allowedOrigins: ALLOWED_HOST_ORIGINS } : {}),
  }

  // The global has shipped under two shapes; try both before giving up.
  const factory = g?.createDashboardClientSdk ?? g?.createClient
  if (typeof factory === 'function') {
    try {
      return factory(config)
    } catch (err) {
      console.error('[dashboard] SDK factory failed', err)
    }
  }
  const Ctor = g?.DashboardClientSdk ?? g?.Client
  if (typeof Ctor === 'function') {
    try {
      return new Ctor(config)
    } catch (err) {
      console.error('[dashboard] SDK constructor failed', err)
    }
  }

  console.warn(
    '[dashboard] MunshotDashboardSDK not found; using no-op SDK. Expected only when running outside the Munshot host iframe.',
  )
  return createNoopSdk()
}

// Single client for the whole app, created at import time so its message
// listener is live before host:init can arrive.
export const sdk: DashboardClientSdk = initSdk()
