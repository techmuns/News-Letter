# Munshot Content System — Live automation setup

This is the **wiring guide** for the real pipeline behind the **Daily Pulse** and **Studio** tabs. The app now has:

- a small backend (a **Cloudflare Worker** in [`worker/index.ts`](worker/index.ts), reusing the logic in [`functions/api/_lib/`](functions/api/_lib)) that keeps every key server-side,
- **Daily Pulse** — the latest market snapshot from your **Daily Market Pulse** dashboard ([techmuns/DailyMarketPulse](https://github.com/techmuns/DailyMarketPulse)), shown as pickable cards (indices, currencies, commodities, holdings) with today / 5-day / 1-month moves and a sparkline. **No key needed** — it reads a public feed,
- **AI generation** — a picked market move → a short, branded **LinkedIn post** and a matching **email newsletter**,
- **Auto-image** — a branded Munshot graphic is rendered per post and (optionally) hosted so **Buffer attaches it automatically**,
- **LinkedIn publishing via Buffer** (posts to the Munshot company page — no LinkedIn app-review wait),
- **Email sending** to your network list.

You supply the accounts and keys; the code is done. There are **three things to wire** (Bedrock, Buffer, Email) — Daily Pulse needs nothing — plus one optional KV namespace for auto-images and one recommended security key. Budget ~20 minutes.

> **How you actually use it each day:** open **Daily Pulse**, pick a market move that matters (biggest movers surface first), click **“Use this → draft mine”** → it lands in **Studio** with that data point prefilled. Hit **Generate**, tweak the two previews, then **Publish** (LinkedIn) and **Send to list** (email).

---

## 1. Daily Pulse (content source) — **no key needed**

The **Daily Pulse** tab reads the latest snapshot your Daily Market Pulse dashboard already publishes — so there's nothing to sign up for.

- **Where the data lives:** [`public/data/live.json`](https://github.com/techmuns/DailyMarketPulse/blob/HEAD/public/data/live.json) in the **techmuns/DailyMarketPulse** repo. That repo's GitHub Action (`refresh-data.yml`) regenerates it **twice daily** (07:00 & 19:00 IST) and commits it back. The same file is served live by the deployed dashboard at `/data/live.json`.
- **How this app reads it:** the Worker fetches it server-side (`GET /api/daily-pulse`), then enriches each instrument with display names/units and ranks the **biggest 1-day movers first**. By default it pulls the rename-proof `HEAD` copy from GitHub, so it tracks whatever the dashboard publishes with no branch pinning.
- **Optional override — `DAILY_PULSE_URL`:** set this variable to point at a different feed — e.g. the deployed dashboard's `https://<your-dashboard>/data/live.json`, or a pinned branch/commit. Leave it unset to use the default GitHub feed.

That's it — open the tab and today's items are there. The instruments are the dashboard's indices, currencies, commodities, and holdings (portfolio + watchlist).

## 2. AWS Bedrock (AI generation) → `BEDROCK_API_KEY` + `BEDROCK_MODEL_ID`

1. In the **AWS Bedrock console** (region **us-east-1**), request access to the Claude model you want under **Model access**, then create a **Bedrock API key** (a Bearer token).
2. Set it as `BEDROCK_API_KEY` (see [§6 Where to paste](#6-where-to-paste-the-keys)).
3. Set `BEDROCK_MODEL_ID` to that model's id or inference-profile id. In us-east-1, current Claude models usually need the cross-region **inference-profile** form (the `us.` prefix), e.g. `us.anthropic.claude-sonnet-4-5-20250929-v1:0`.

Generation calls Bedrock's native runtime endpoint — `POST https://bedrock-runtime.us-east-1.amazonaws.com/model/<id>/invoke` with `Authorization: Bearer …`. `/api/health` then reports `aiProvider: "bedrock"`.

_Optional:_ `BEDROCK_REGION` overrides the region (default `us-east-1`). To fall back to the **direct Anthropic API** instead, leave `BEDROCK_API_KEY` unset and set `ANTHROPIC_API_KEY` (+ optional `GEN_MODEL`, default `claude-opus-5`).

## 2b. Topic mode (recent-news lookup) → `NEWSAPI_KEY`

The Daily Pulse composer has a **Topic** tab: type a keyword (a company, person, or news theme) and it fetches recent news, then grounds the post in those real sources. It uses **NewsAPI.org**'s `/v2/everything` endpoint.

1. Register at [newsapi.org/register](https://newsapi.org/register) to get an API key.
2. Set `NEWSAPI_KEY` to that key (see [§6 Where to paste](#6-where-to-paste-the-keys)). It's sent server-side as the `X-Api-Key` header — never exposed to the browser. `/api/health` then reports `topicNews: true`.

The query is `GET https://newsapi.org/v2/everything?q=<topic>&language=en&sortBy=publishedAt&pageSize=10`; only each article's title/description/url/source/publishedAt is fed to the model. If NewsAPI returns zero results the composer says “no recent news found” and generates nothing — it never fabricates. The free Developer plan is rate-limited and restricted to non-production use; a paid plan is required for live/production requests. Topic mode is optional — the market mode works without it.

## 3. Buffer (LinkedIn publishing) → `BUFFER_ACCESS_TOKEN` + `BUFFER_LINKEDIN_CHANNEL_ID`

Buffer already has an approved LinkedIn integration, so this sidesteps LinkedIn's own Community-Management-API approval (which takes days–weeks).

1. Create a **Buffer** account (the free plan is enough) and **connect the Munshot LinkedIn page** to it (Buffer → Channels → Connect → LinkedIn → pick the **Company Page**, not your personal profile).
2. Generate a token: **https://publish.buffer.com/settings/api → Generate API key**. Copy it → `BUFFER_ACCESS_TOKEN`.
3. Get the LinkedIn **channel id**:
   - Easiest: open Buffer's **GraphQL Explorer** (https://developers.buffer.com/explorer), run
     ```graphql
     query { channels(input: { organizationId: "YOUR_ORG_ID" }) { id name service } }
     ```
     and copy the `id` of the LinkedIn company-page channel.
   - Or set `BUFFER_ORG_ID` and hit `/api/buffer-channels` on your deployed site — it lists them for you.
   - Paste that id → `BUFFER_LINKEDIN_CHANNEL_ID`.

**Images:** Buffer attaches images **by public URL only** (no direct upload). Studio now **auto-renders a branded Munshot graphic** for every post (the headline on a Munshot template) — see the auto-image section below. You can still paste your own **Custom image URL** (e.g. a dashboard screenshot) to override it, or leave both off for a text-only post.

### Auto-image (optional but recommended) → Workers KV `STORE` binding

To let Buffer attach the auto-rendered graphic, it must be hosted at a public URL. The app renders the PNG in the browser, uploads it to **Workers KV**, and serves it at `/img/<id>` — all free, no R2/billing. One-time setup:

1. Create the namespace (free):
   ```bash
   npx wrangler kv namespace create STORE
   ```
   It prints an `id` like `"id": "a1b2c3…"`.
2. Open [`wrangler.jsonc`](wrangler.jsonc), find the commented `kv_namespaces` line at the bottom, paste your id, and **un-comment it** (drop the leading `// ,` so it becomes a real sibling of `"assets"`):
   ```jsonc
   ,"kv_namespaces": [{ "binding": "STORE", "id": "a1b2c3…" }]
   ```
3. Commit + push (or redeploy). `/api/health` then shows `"images": true`, and **Publish** uploads the branded graphic and hands Buffer the URL automatically.

Until you do this the app runs fine — Studio just posts **text-only** (or whatever Custom image URL you paste). **Don't commit a fake id** — the deploy validates the namespace and would fail.

## 3b. Buffer OAuth — "Connect Buffer" (per-user LinkedIn publishing)

This is a **separate, optional** feature from §3 above: instead of one shared `BUFFER_ACCESS_TOKEN` posting to the Munshot page, each person opening this dashboard from inside Munshot can connect **their own** Buffer account and post to **their own** LinkedIn channel through it. Both paths work side by side — §3's static token keeps working as a fallback/escape hatch.

**How identity works here:** "the authenticated user" is whoever the Munshot host says they are — the `email` claim inside the Munshot JWT that's already wired up via the host-session SDK (`src/lib/sdk.ts` / `useHostSession()`). The frontend forwards that JWT as `Authorization: Bearer <token>` to every `/api/buffer/*` and `/api/auth/buffer*` call, and the backend reads the `email` claim out of it (`functions/api/_lib/munshotAuth.ts`).

> ⚠️ **By default the backend does NOT verify that JWT's signature** — it decodes the payload and trusts the email. In that state there is **no real isolation between clients**: anyone who can reach these endpoints can claim to be any email and reach that email's Buffer connection. **Do not put two real clients on a deployment in this state.** The verification code is written and tested; it just needs a key — see below.

### Turning on real per-client isolation

`/api/health` reports which mode you're in as `munshotSession`:

| Mode | Meaning |
| --- | --- |
| `unverified` | Default. Email claim trusted without checking a signature. **Clients are not isolated.** |
| `verified` | Signatures checked, but a caller with no session still falls back to the shared guest identity. Rollout only. |
| `enforced` | Every request needs a validly-signed Munshot session. **This is the one to run in production.** |

**Step 1 — get a key from whoever runs Munshot's auth.** Exactly one of these:

| Variable | When to use it |
| --- | --- |
| `MUNSHOT_JWKS_URL` | Munshot publishes a JWKS endpoint (RS256/ES256). Preferred — handles key rotation automatically. |
| `MUNSHOT_JWT_PUBLIC_KEY` | A single static public key, as a **JWK JSON object** (RS256/ES256). |
| `MUNSHOT_JWT_HMAC_SECRET` | Munshot signs with HS256 using a shared secret. |

Optionally also set `MUNSHOT_JWT_ISSUER` and `MUNSHOT_JWT_AUDIENCE` — each is checked only when set, and both are worth setting if Munshot populates them.

**Step 2 — verify before enforcing.** Set just the key first and redeploy. `/api/health` should show `"munshotSession": "verified"`. Open the dashboard from inside Munshot and confirm it still works — a valid session now proves itself, while a forged one is rejected.

**Step 3 — enforce.** Set `MUNSHOT_REQUIRE_VERIFIED_SESSION=true` and redeploy. `/api/health` shows `"enforced"`. The shared guest fallback is now gone: the dashboard only works embedded in Munshot, and each client's email gets its own isolated Buffer connection.

No code changes are needed for any of this — it's configuration. If enforcement is switched on without a key configured, the API fails loudly (500) rather than silently letting everyone in.

### Setup

1. **Register a Buffer OAuth app** (not the same as the personal API key from §3): **publish.buffer.com/settings/api → App Clients tab → New Client**. (The old `buffer.com/developers/apps` page is for Buffer's legacy REST API, being retired — it has no "create app" option anymore.)
   - Redirect URI: `https://<your-domain>/api/auth/buffer/callback` (and `http://localhost:5173/api/auth/buffer/callback` too if you want OAuth to work in local dev).
   - Copy the **Client ID**. Buffer's "App Clients" currently only issue a client_id — no client_secret — meaning this is a **public PKCE client**. That's expected and fully supported: PKCE (which Buffer requires on every client) is specifically designed to secure a client without a secret. Leave `BUFFER_CLIENT_SECRET` unset.
2. **Create a D1 database** for the per-user connection rows:
   ```bash
   npx wrangler d1 create news-letter-db
   ```
   Paste the printed `database_id` into the commented `d1_databases` block at the bottom of [`wrangler.jsonc`](wrangler.jsonc) and un-comment it (same pattern as the KV block above).
3. **Run the migration** to create the tables:
   ```bash
   npx wrangler d1 migrations apply news-letter-db --remote   # production
   npx wrangler d1 migrations apply news-letter-db            # local dev DB
   ```
4. **Generate an encryption key** for tokens at rest:
   ```bash
   openssl rand -base64 32
   ```
5. Set three variables (see §6 for where to paste them): `BUFFER_CLIENT_ID`, `BUFFER_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`. Skip `BUFFER_CLIENT_SECRET` unless Buffer actually gave you one.
6. Redeploy. `/api/health` then shows `"bufferOAuth": true`. Open **Channels → LinkedIn** — a **Connect Buffer** card appears above the post list (only when opened from inside Munshot, since that's where the session identity comes from).

### How the pieces fit together

- **Endpoints** (`worker/index.ts`, logic in `functions/api/_lib/bufferOAuth.ts` / `bufferAccounts.ts` / `buffer.ts`):
  - `GET /api/auth/buffer` — fetch-based (not a raw navigation, so it can carry the Munshot `Authorization` header); returns `{ authorizeUrl }`, generating and storing the PKCE `code_verifier` + `state` in D1. The frontend does the actual redirect.
  - `GET /api/auth/buffer/callback` — Buffer redirects the browser here after approval. Verifies `state`, exchanges the code (with the matching `code_verifier`) for tokens server-side, encrypts and stores them, then redirects back into the app (`/channels?buffer=connected` or `?buffer=error&reason=…`).
  - `GET /api/buffer/organizations`, `GET /api/buffer/channels?organizationId=…`, `GET /api/buffer/connection` — read-only discovery + current status.
  - `POST /api/buffer/select-channel` — persists the chosen channel, after independently re-fetching that org's channels server-side and confirming the id actually belongs there (never trusts a client-supplied channel id).
  - `POST /api/buffer/posts` — publishes to the caller's selected channel via their (auto-refreshed) OAuth token.
  - `DELETE /api/buffer/disconnect` — marks the connection disconnected and wipes the stored tokens; the user has to reconnect from scratch.
- **Tokens at rest:** AES-256-GCM via `functions/api/_lib/crypto.ts`, keyed by `TOKEN_ENCRYPTION_KEY`. Nothing ever logs a token value.
- **Refresh:** Buffer refresh tokens are **single-use** — every refresh rotates it, and the rotated value is what gets persisted. If a refresh ever fails (revoked, expired), the connection is marked disconnected and the next call returns a 401 telling the user to reconnect, instead of a confusing raw Buffer error.

## 4. Email (newsletter) → `RESEND_API_KEY` + `EMAIL_FROM` (+ `EMAIL_RECIPIENTS`)

Default provider is **Resend** (simplest). To use SendGrid instead, set `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY`.

1. Create a **Resend** account → **API Keys → Create** → copy → `RESEND_API_KEY`.
2. **Verify a sender domain** (Resend → Domains → add DNS records). Until DNS propagates you can test with Resend's sandbox sender.
3. Set `EMAIL_FROM`, e.g. `Munshot Intelligence <news@munshot.io>`.
4. _Optional:_ set `EMAIL_RECIPIENTS` to your default network list (comma/newline separated). You can also paste recipients per-send in Studio. Recipients are always **BCC'd**, so they never see each other.

## 5. Security (recommended) → `APP_SECRET`

Your publish/send endpoints spend money and post publicly, so lock them down: set `APP_SECRET` to any long random string. When set, Studio shows an **"App secret"** field — paste the same value there once (stored in your browser). Without `APP_SECRET` the endpoints are open (fine for local testing, not for a public URL).

---

## 5b. Munshot host embedding (JWT session) → `VITE_MUNSHOT_ALLOWED_ORIGINS`

When embedded in the Munshot host (`https://chat.muns.io`) as an iframe, the app takes its session (JWT + identity) automatically via the **Munshot Dashboard SDK** — no login screen. `VITE_MUNSHOT_ALLOWED_ORIGINS` is the trust boundary for that handshake: a comma-separated list of exact scheme+host origins allowed to hand the app a session. It's a **client-side build var** (copy [`.env.example`](.env.example) to `.env`, or set it in your host's build environment) — it defaults to `https://chat.muns.io` if unset, so you only need to set it to add another origin, never to enable the default one.

Outside the Munshot iframe — opening the app directly, or before any session arrives — it signs in as a local **Guest** session instead of hanging on a loading screen. See `src/lib/sdk.ts`, `src/lib/hostMessageGuard.ts`, and `src/hooks/useHostContext.ts`.

---

## 6. Where to paste the keys

This deploys as a **Cloudflare Worker** (`news-letter`, config in [`wrangler.jsonc`](wrangler.jsonc); the API lives in [`worker/index.ts`](worker/index.ts)). Add keys in:

**Cloudflare dashboard → Workers & Pages → `news-letter` → Settings → Variables and Secrets.**

- Add each variable; choose **Secret** (encrypted) for anything sensitive. **Save.**
- **Redeploy** so the Worker picks up the new values — push to your connected branch, or re-run the latest deployment from the dashboard. New variables only apply to a *fresh* deployment.

| Variable | Required | What it is |
|---|---|---|
| `DAILY_PULSE_URL` | — | Override for the Daily Pulse feed URL (defaults to the public GitHub feed) |
| `BEDROCK_API_KEY` | ✅ | Bedrock Bearer API key for generation |
| `BEDROCK_MODEL_ID` | ✅ | Bedrock model / inference-profile id (e.g. `us.anthropic.claude-sonnet-4-5-20250929-v1:0`) |
| `BEDROCK_REGION` | — | Bedrock region (default `us-east-1`) |
| `ANTHROPIC_API_KEY` | — | Direct Anthropic key — fallback when no `BEDROCK_API_KEY` |
| `GEN_MODEL` | — | Model override (Anthropic-direct default `claude-opus-5`) |
| `NEWSAPI_KEY` | — (Topic mode) | NewsAPI.org key for the composer's Topic tab (recent-news lookup) |
| `BUFFER_ACCESS_TOKEN` | ✅ (LinkedIn) | Buffer API token |
| `BUFFER_LINKEDIN_CHANNEL_ID` | ✅ (LinkedIn) | Buffer channel id for the Munshot page |
| `BUFFER_ORG_ID` | — | Enables `/api/buffer-channels` discovery |
| `EMAIL_PROVIDER` | — | `resend` (default) or `sendgrid` |
| `RESEND_API_KEY` | ✅ (email) | Resend key (or `SENDGRID_API_KEY`) |
| `EMAIL_FROM` | ✅ (email) | Verified sender, e.g. `Munshot <news@…>` |
| `EMAIL_RECIPIENTS` | — | Default recipient list |
| `APP_SECRET` | recommended | Shared secret guarding the write endpoints |

---

## 7. Test it

1. Open your deployed site → **Daily Pulse** tab. Today's market cards load automatically (biggest movers first). Use the **All / Indices / Currencies / Commodities / Holdings** filter, then click **“Use this → draft mine”** on a move you like.
2. You land in **Studio** with that data point prefilled and a **branded image preview** already rendered under the post. The **Connections** panel shows green dots for **AI**, **LinkedIn (Buffer)**, **Email**, and (if you did the KV step) **Image**. Any grey dot names the missing key.
3. Hit **Generate** → a LinkedIn post and newsletter preview appear in a few seconds; the branded image updates to the new headline.
4. **Publish** → check it appears in your Buffer queue / on the Munshot LinkedIn page. With the KV binding on, the post carries the branded image; without it, it's text-only (or your Custom image URL).
5. Put your own address in **Recipients** → **Send to list** → confirm it lands in your inbox.

If a step errors, the exact reason is shown inline (e.g. "Could not reach the Daily Pulse feed", or "Image storage not configured" if you skipped the KV step).

---

## 8. Run it locally (optional)

```bash
cp .dev.vars.example .dev.vars   # fill in your keys (BEDROCK_API_KEY, etc.)
npm run dev                      # → http://localhost:5173
```

`npm run dev` serves the SPA **and** the `/api/*` Worker together (via
`@cloudflare/vite-plugin`, reading `.dev.vars`), so Daily Pulse/Studio work
end-to-end locally (Daily Pulse fetches the public feed — no key needed).
`npm run deploy` builds and deploys the Worker. `.dev.vars` is gitignored.

`.dev.vars` is gitignored — real keys never get committed.

---

## Endpoint reference

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | which integrations are wired (booleans only, incl. `dailyPulse`, `images`) |
| `/api/daily-pulse` | GET | latest Daily Market Pulse items (enriched + ranked) for the picker |
| `/api/upload-image` | POST | store the branded PNG in KV → returns its public URL |
| `/img/<id>` | GET | serve a stored image (this is the URL handed to Buffer) |
| `/api/generate` | POST | source → `{ linkedin, email }` |
| `/api/publish-linkedin` | POST | push a post to the LinkedIn page via Buffer |
| `/api/send-email` | POST | send the newsletter to the list |
| `/api/buffer-channels` | GET | list Buffer channels (needs `BUFFER_ORG_ID`) |

## Honest limits (so there are no surprises)

- **Daily Pulse is only as fresh as the source repo.** The dashboard's Action refreshes `live.json` twice daily (07:00 & 19:00 IST) — the card header shows how long ago (`updated Xh ago`). If that repo's cron is paused or the file moves, point `DAILY_PULSE_URL` at a live feed. Scheduled Actions only run on the source repo's **default branch**.
- **Company-page auto-posting works today only because Buffer holds the approved integration.** LinkedIn's own API would require Community-Management-API approval first.
- **Email "from your domain"** needs one-time DNS verification; sandbox sending works immediately.
