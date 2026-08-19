-- Per-user Buffer OAuth connections and the short-lived PKCE handshake state.
-- Apply with: npx wrangler d1 migrations apply news-letter-db (see SETUP.md).

-- One row per Munshot user (keyed by the email claim from their Munshot JWT —
-- see functions/api/_lib/munshotAuth.ts for the current trust caveat on that
-- identity). access_token_enc / refresh_token_enc are AES-256-GCM ciphertext
-- (functions/api/_lib/crypto.ts) — never store a raw Buffer token here.
CREATE TABLE IF NOT EXISTS buffer_connections (
  user_email TEXT PRIMARY KEY,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  token_expires_at INTEGER NOT NULL,
  scope TEXT,
  organization_id TEXT,
  channel_id TEXT,
  channel_name TEXT,
  channel_service TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Bridges the two separate HTTP requests in the OAuth redirect round trip:
-- the PKCE code_verifier (and which user started the flow) has to survive
-- from GET /api/auth/buffer to GET /api/auth/buffer/callback. Single-use —
-- every row is deleted the moment it's read (see consumeOAuthState).
CREATE TABLE IF NOT EXISTS buffer_oauth_state (
  state TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
