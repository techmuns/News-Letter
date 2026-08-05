# Munshot Content System — Live automation setup

This is the **wiring guide** for the real pipeline behind the **Discover** and **Studio** tabs. The app now has:

- a small backend (**Cloudflare Pages Functions** under [`functions/api/`](functions/api)) that keeps every key server-side,
- **Discover** — find recent public LinkedIn finance posts by topic or across curated creators (via web search — Tavily or Serper),
- **AI generation** — a standout post + a Munshot dashboard data point → a short, branded **LinkedIn post** and a matching **email newsletter**,
- **LinkedIn publishing via Buffer** (posts to the Munshot company page — no LinkedIn app-review wait),
- **Email sending** to your network list.

You supply the accounts and keys; the code is done. There are **four things to wire** (Tavily, Anthropic, Buffer, Email) plus one recommended security key. Budget ~25 minutes.

> **How you actually use it each day:** open **Discover**, search a topic (or scan your top creators), click **“Use this → draft mine”** on the standout post → it lands in **Studio** with the post prefilled. Add one Munshot data point, hit **Generate**, tweak the two previews, then **Publish** (LinkedIn) and **Send to list** (email). Google indexes only *public* LinkedIn posts (no like/comment counts), so Discover ranks by recency + curated creators — great for surfacing ideas, and fully ToS-safe (public search, not feed scraping).

---

## 1. Tavily (Discover — find posts) → `TAVILY_API_KEY`

Discover queries a web-search API for **public** LinkedIn posts (constrained to `linkedin.com`), so there's no LinkedIn API and no scraping. It's provider-agnostic — **Tavily is the recommended one** (easy signup, free tier, no credit card):

1. Sign up at **https://tavily.com** (email or Google; free tier includes ~1,000 credits/month).
2. Copy the API key from the dashboard — it starts with `tvly-` → set it as `TAVILY_API_KEY`.
3. Tune the curated creator list any time in [`functions/api/_lib/discover.ts`](functions/api/_lib/discover.ts) (`CURATED_HANDLES`). Each handle costs one search in "Top creators" mode.

> **Prefer Serper (Google) instead?** Set `SERPER_API_KEY` (from serper.dev) and leave `TAVILY_API_KEY` blank — the code uses whichever is present (Tavily wins if both are set).

> Coverage note: web search indexes only public posts and exposes no engagement metrics, so Discover ranks by recency + finance-keyword match, not by likes. That's expected — it's an idea finder, not a feed reader.

## 2. Anthropic (AI generation) → `ANTHROPIC_API_KEY`

1. Go to **console.anthropic.com → Settings → API Keys → Create Key**.
2. Copy the key (starts with `sk-ant-`).
3. Set it as `ANTHROPIC_API_KEY` (see [§6 Where to paste](#6-where-to-paste-the-keys)).

_Optional:_ `GEN_MODEL` overrides the model (default `claude-opus-5`; `claude-sonnet-5` is faster/cheaper).

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

**Images:** Buffer attaches images **by public URL only** (no direct upload). In Studio, paste a publicly-hosted image URL (e.g. a dashboard screenshot) into "Post image URL". Leave blank for a text-only post. _(Auto-generating a hosted branded graphic per post is the natural next step — it needs an image host like Cloudflare R2.)_

## 4. Email (newsletter) → `RESEND_API_KEY` + `EMAIL_FROM` (+ `EMAIL_RECIPIENTS`)

Default provider is **Resend** (simplest). To use SendGrid instead, set `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY`.

1. Create a **Resend** account → **API Keys → Create** → copy → `RESEND_API_KEY`.
2. **Verify a sender domain** (Resend → Domains → add DNS records). Until DNS propagates you can test with Resend's sandbox sender.
3. Set `EMAIL_FROM`, e.g. `Munshot Intelligence <news@munshot.io>`.
4. _Optional:_ set `EMAIL_RECIPIENTS` to your default network list (comma/newline separated). You can also paste recipients per-send in Studio. Recipients are always **BCC'd**, so they never see each other.

## 5. Security (recommended) → `APP_SECRET`

Your publish/send endpoints spend money and post publicly, so lock them down: set `APP_SECRET` to any long random string. When set, Studio shows an **"App secret"** field — paste the same value there once (stored in your browser). Without `APP_SECRET` the endpoints are open (fine for local testing, not for a public URL).

---

## 6. Where to paste the keys

This deploys as a **Cloudflare Worker** (`news-letter`, config in [`wrangler.jsonc`](wrangler.jsonc); the API lives in [`worker/index.ts`](worker/index.ts)). Add keys in:

**Cloudflare dashboard → Workers & Pages → `news-letter` → Settings → Variables and Secrets.**

- Add each variable; choose **Secret** (encrypted) for anything sensitive. **Save.**
- **Redeploy** so the Worker picks up the new values — push to your connected branch, or re-run the latest deployment from the dashboard. New variables only apply to a *fresh* deployment.

| Variable | Required | What it is |
|---|---|---|
| `TAVILY_API_KEY` | ✅ (Discover) | Tavily search key (tavily.com); or `SERPER_API_KEY` |
| `ANTHROPIC_API_KEY` | ✅ | Claude key for generation |
| `GEN_MODEL` | — | Model override (default `claude-opus-5`) |
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

1. Open your deployed site → **Discover** tab. Search a topic (e.g. "unit economics") or flip to **Top creators** → recent posts should appear. Click **“Use this → draft mine”** on one.
2. You land in **Studio** with that post prefilled. The **Connections** panel should show green dots for **AI**, **LinkedIn (Buffer)**, **Email** once wired (Discover shows its own status on its tab). Any grey dot names the missing key.
3. Add an optional dashboard data point → **Generate**. A LinkedIn post and newsletter preview appear in a few seconds.
4. **Publish** → check it appears in your Buffer queue / on the Munshot LinkedIn page.
5. Put your own address in **Recipients** → **Send to list** → confirm it lands in your inbox.

If a step errors, the exact reason is shown inline (e.g. "No Discover key set — add TAVILY_API_KEY").

---

## 8. Run it locally (optional)

```bash
cp .dev.vars.example .dev.vars   # fill in your keys (SERPER_API_KEY, etc.)
npm run dev                      # → http://localhost:5173
```

`npm run dev` serves the SPA **and** the `/api/*` Worker together (via
`@cloudflare/vite-plugin`, reading `.dev.vars`), so Discover/Studio work
end-to-end locally. `npm run deploy` builds and deploys the Worker. `.dev.vars`
is gitignored.

`.dev.vars` is gitignored — real keys never get committed.

---

## Endpoint reference

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | which integrations are wired (booleans only) |
| `/api/search-posts` | POST | Discover: find public LinkedIn posts via Serper |
| `/api/generate` | POST | source → `{ linkedin, email }` |
| `/api/publish-linkedin` | POST | push a post to the LinkedIn page via Buffer |
| `/api/send-email` | POST | send the newsletter to the list |
| `/api/buffer-channels` | GET | list Buffer channels (needs `BUFFER_ORG_ID`) |

## Honest limits (so there are no surprises)

- **No official LinkedIn API can auto-read other people's posts.** Discover works around this the only ToS-safe way — Google's index of *public* LinkedIn posts (via Serper) — so coverage is partial and there are **no engagement metrics** (likes/comments). It ranks by recency + curated creators, which is ideal for surfacing ideas; you still pick the standout post, then the engine does the rest. (A paid scraper could widen coverage but breaks LinkedIn's ToS — deliberately not used.)
- **Company-page auto-posting works today only because Buffer holds the approved integration.** LinkedIn's own API would require Community-Management-API approval first.
- **Email "from your domain"** needs one-time DNS verification; sandbox sending works immediately.
