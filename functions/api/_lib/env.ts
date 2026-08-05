/* ============================================================
   Environment bindings for the Munshot Content System API.

   These are set BY YOU in the Cloudflare dashboard
   (Workers & Pages → your project → Settings → Variables and Secrets),
   or in a local `.dev.vars` file for `wrangler pages dev`.
   See SETUP.md for exactly where each one comes from.
   Never hard-code secrets in the repo.
   ============================================================ */

export interface Env {
  // --- Discover (find public LinkedIn posts via Serper / Google search) ---
  /** Free key from serper.dev — reads public Google results, ToS-safe. */
  SERPER_API_KEY?: string

  // --- AI generation (Anthropic Claude) ---
  ANTHROPIC_API_KEY?: string
  /** Optional model override. Defaults to claude-opus-5. */
  GEN_MODEL?: string

  // --- LinkedIn publishing, via Buffer's GraphQL API ---
  /** Personal access token from https://publish.buffer.com/settings/api */
  BUFFER_ACCESS_TOKEN?: string
  /** Buffer channel id for the Munshot LinkedIn page (see SETUP.md). */
  BUFFER_LINKEDIN_CHANNEL_ID?: string
  /** Optional — only used by the /api/buffer-channels discovery helper. */
  BUFFER_ORG_ID?: string

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
  return {
    discover: Boolean(env.SERPER_API_KEY),
    ai: Boolean(env.ANTHROPIC_API_KEY),
    linkedin: Boolean(env.BUFFER_ACCESS_TOKEN && env.BUFFER_LINKEDIN_CHANNEL_ID),
    email: Boolean(emailKey && env.EMAIL_FROM),
    emailProvider: provider,
    /** whether a shared app secret is required to call the write endpoints */
    authRequired: Boolean(env.APP_SECRET),
    model: env.GEN_MODEL || 'claude-opus-5',
    hasDefaultRecipients: Boolean(env.EMAIL_RECIPIENTS && env.EMAIL_RECIPIENTS.trim()),
  }
}
