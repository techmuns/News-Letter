/* ============================================================
   Environment bindings for the Munshot Content System API.

   These are set BY YOU in the Cloudflare dashboard
   (Workers & Pages → your project → Settings → Variables and Secrets),
   or in a local `.dev.vars` file for `wrangler pages dev`.
   See SETUP.md for exactly where each one comes from.
   Never hard-code secrets in the repo.
   ============================================================ */

/** Default Bedrock model id when BEDROCK_MODEL_ID / GEN_MODEL are unset.
    A real current Sonnet inference-profile id for us-east-1 — override with
    BEDROCK_MODEL_ID to match your account's enabled model/profile. */
export const DEFAULT_BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

/** Minimal Workers KV surface (avoids a @cloudflare/workers-types dependency). */
export interface KVLike {
  get(key: string, opts?: any): Promise<any>
  getWithMetadata(key: string, opts?: any): Promise<{ value: any; metadata: any } | null>
  put(key: string, value: any, opts?: any): Promise<void>
}

/** Minimal D1 surface (avoids a @cloudflare/workers-types dependency) —
    covers the subset used by functions/api/_lib/bufferOAuth.ts and
    bufferAccounts.ts. */
export interface D1Like {
  prepare(query: string): D1PreparedStatementLike
}
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike
  first<T = any>(colName?: string): Promise<T | null>
  run(): Promise<{ meta?: { changes?: number }; changes?: number }>
  all<T = any>(): Promise<{ results: T[] }>
}

export interface Env {
  // --- Daily Pulse (content source) ---
  /** Optional override for the Daily Market Pulse feed URL. Defaults to the
      public `public/data/live.json` on techmuns/DailyMarketPulse (HEAD ref).
      Point it at the deployed dashboard's …/data/live.json to pin the source. */
  DAILY_PULSE_URL?: string

  // --- Auto-image hosting (Workers KV) — optional; publish falls back to a
  //     pasted URL when absent. Create a namespace and bind it as STORE. */
  STORE?: KVLike

  // --- AI generation (AWS Bedrock, Bearer API key) ---
  /** Bedrock API key sent as `Authorization: Bearer …`. When set, generation
      goes to Bedrock's native runtime invoke endpoint. */
  BEDROCK_API_KEY?: string
  /** Bedrock model id / inference-profile id used in the invoke URL, e.g.
      `anthropic.claude-sonnet-4-5-20250929-v1:0` or a `us.anthropic.…` profile. */
  BEDROCK_MODEL_ID?: string
  /** Bedrock runtime region (host). Defaults to us-east-1. */
  BEDROCK_REGION?: string

  // --- AI generation (Anthropic Claude, direct — fallback when no Bedrock) ---
  ANTHROPIC_API_KEY?: string
  /** Optional model override (Anthropic direct default claude-opus-5; also used
      as the Bedrock model id when BEDROCK_MODEL_ID is unset). */
  GEN_MODEL?: string

  // --- Topic mode: recent-news lookup (NewsAPI.org) ---
  /** NewsAPI.org API key, sent as the `X-Api-Key` header to the /v2/everything
      endpoint. A keyword returns real, recent articles across sources. */
  NEWSAPI_KEY?: string

  // --- Stock/company search (Munshot backend) ---
  /** Bearer token for the Munshot stock-search API (devde.muns.io/stock/search),
      proxied server-side by /api/stock-search. */
  MUNS_ACCESS_TOKEN?: string

  // --- LinkedIn publishing, via Buffer's GraphQL API ---
  /** Personal access token from https://publish.buffer.com/settings/api */
  BUFFER_ACCESS_TOKEN?: string
  /** Buffer channel id for the Munshot LinkedIn page (see SETUP.md). */
  BUFFER_LINKEDIN_CHANNEL_ID?: string
  /** Optional — only used by the /api/buffer-channels discovery helper. */
  BUFFER_ORG_ID?: string

  // --- Buffer OAuth (per-user "Connect Buffer" — see SETUP.md) ---
  /** D1 binding storing per-user Buffer OAuth connections + PKCE handshake
      state (see migrations/0001_buffer_oauth.sql). */
  DB?: D1Like
  /** Buffer OAuth app client id — register an app at https://buffer.com/developers/apps. */
  BUFFER_CLIENT_ID?: string
  /** Buffer OAuth app client secret — OPTIONAL. Buffer's current "App Clients" UI only
      issues a client_id (public PKCE client, no secret); set this only if a future Buffer
      app type actually issues one. Never sent to Buffer when unset (see bufferOAuth.ts). */
  BUFFER_CLIENT_SECRET?: string
  /** Must exactly match the redirect URI registered with the Buffer OAuth app,
      e.g. https://<your-domain>/api/auth/buffer/callback */
  BUFFER_REDIRECT_URI?: string
  /** Base64-encoded 32-byte AES-256-GCM key used to encrypt stored Buffer
      OAuth tokens at rest. Generate with: openssl rand -base64 32 */
  TOKEN_ENCRYPTION_KEY?: string

  // --- Munshot session verification (per-client isolation — see SETUP.md) ---
  // The email claim in a Munshot JWT keys every per-user Buffer connection,
  // so it must be verified before it can be trusted. Set exactly ONE key
  // source, whichever Munshot's auth team provides.
  /** JWKS endpoint for the Munshot issuer (RS256/ES256, supports rotation). */
  MUNSHOT_JWKS_URL?: string
  /** A single Munshot public key as a JWK JSON object (RS256/ES256). */
  MUNSHOT_JWT_PUBLIC_KEY?: string
  /** Shared symmetric signing secret, if Munshot signs with HS256. */
  MUNSHOT_JWT_HMAC_SECRET?: string
  /** Optional expected `iss` claim — checked only when set. */
  MUNSHOT_JWT_ISSUER?: string
  /** Optional expected `aud` claim — checked only when set. */
  MUNSHOT_JWT_AUDIENCE?: string
  /** 'true' to reject any request without a verified Munshot session — no
      shared-guest fallback. Required for real multi-client isolation. */
  MUNSHOT_REQUIRE_VERIFIED_SESSION?: string

  // --- Email newsletter ---
  /** 'resend' (default) | 'sendgrid'. Provider-agnostic — swap freely. */
  EMAIL_PROVIDER?: string
  RESEND_API_KEY?: string
  SENDGRID_API_KEY?: string
  /** Verified sender, e.g. "Munshot Intelligence <news@munshot.io>". */
  EMAIL_FROM?: string
  /** Comma-separated default recipient list (the UI can override per send). */
  EMAIL_RECIPIENTS?: string

  // --- Security ---
  /** If set, every generate/publish/send call must send it in `x-app-secret`. */
  APP_SECRET?: string
}

/** Non-secret view of what's wired up — booleans only, never the values.
    Powers the "connection status" panel in the UI so you can verify the wiring. */
export function configuredFlags(env: Env) {
  const provider = (env.EMAIL_PROVIDER || 'resend').toLowerCase()
  const emailKey = provider === 'sendgrid' ? env.SENDGRID_API_KEY : env.RESEND_API_KEY
  const aiProvider = env.BEDROCK_API_KEY ? 'bedrock' : env.ANTHROPIC_API_KEY ? 'anthropic' : 'none'
  const model = env.BEDROCK_API_KEY
    ? env.BEDROCK_MODEL_ID || env.GEN_MODEL || DEFAULT_BEDROCK_MODEL
    : env.GEN_MODEL || 'claude-opus-5'
  return {
    /** Daily Pulse feed is a public source — always available (no key needed). */
    dailyPulse: true,
    /** auto-image hosting available (KV bound) */
    images: Boolean(env.STORE),
    /** AI generation is wired (Bedrock preferred, Anthropic direct as fallback) */
    ai: Boolean(env.BEDROCK_API_KEY || env.ANTHROPIC_API_KEY),
    /** which provider serves generation: 'bedrock' | 'anthropic' | 'none' */
    aiProvider,
    /** Topic mode (recent-news lookup) is wired — NewsAPI key set */
    topicNews: Boolean(env.NEWSAPI_KEY),
    /** Live stock/company search is wired — Munshot token set */
    stockSearch: Boolean(env.MUNS_ACCESS_TOKEN),
    linkedin: Boolean(env.BUFFER_ACCESS_TOKEN && env.BUFFER_LINKEDIN_CHANNEL_ID),
    /** per-user "Connect Buffer" OAuth is wired (client id/redirect + DB + encryption key).
        BUFFER_CLIENT_SECRET is deliberately NOT required here — Buffer's "App Clients"
        only issue a client_id (public PKCE client, no secret), so this app supports
        running without one; see bufferOAuth.ts, which only sends client_secret if set. */
    bufferOAuth: Boolean(env.BUFFER_CLIENT_ID && env.BUFFER_REDIRECT_URI && env.TOKEN_ENCRYPTION_KEY && env.DB),
    email: Boolean(emailKey && env.EMAIL_FROM),
    emailProvider: provider,
    /** whether a shared app secret is required to call the write endpoints */
    authRequired: Boolean(env.APP_SECRET),
    /** Munshot session handling: 'enforced' = every request needs a verified
        Munshot JWT (per-client isolation is real); 'verified' = signatures are
        checked but a session-less caller still falls back to the shared guest
        identity; 'unverified' = the email claim is trusted without checking a
        signature, so clients are NOT isolated. See functions/api/_lib/munshotAuth.ts. */
    munshotSession: (() => {
      const configured = Boolean(
        env.MUNSHOT_JWKS_URL || env.MUNSHOT_JWT_PUBLIC_KEY || env.MUNSHOT_JWT_HMAC_SECRET,
      )
      const enforce = String(env.MUNSHOT_REQUIRE_VERIFIED_SESSION || '').toLowerCase() === 'true'
      if (configured && enforce) return 'enforced'
      if (configured) return 'verified'
      return 'unverified'
    })(),
    model,
    hasDefaultRecipients: Boolean(env.EMAIL_RECIPIENTS && env.EMAIL_RECIPIENTS.trim()),
  }
}
