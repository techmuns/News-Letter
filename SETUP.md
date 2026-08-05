# Munshot Content System — Live automation setup

This is the **wiring guide** for the real pipeline behind the **Studio** tab. The app now has:

- a small backend (**Cloudflare Pages Functions** under [`functions/api/`](functions/api)) that keeps every key server-side,
- **AI generation** — paste a standout finance post + a Munshot dashboard data point → a short, branded **LinkedIn post** and a matching **email newsletter**,
- **LinkedIn publishing via Buffer** (posts to the Munshot company page — no LinkedIn app-review wait),
- **Email sending** to your network list.

You supply the accounts and keys; the code is done. There are **three things to wire** (Anthropic, Buffer, Email) plus one recommended security key. Budget ~20 minutes.

> **How you actually use it each day:** open **Studio**, paste the best finance post you saw today + one Munshot data point, hit **Generate**, glance at the two previews, tweak if needed, then **Publish** (LinkedIn) and **Send to list** (email). LinkedIn does not offer an API to *auto-scan* other people's posts, so picking the standout post is the one manual step — everything after it is automated.

---

## 1. Anthropic (AI generation) → `ANTHROPIC_API_KEY`

1. Go to **console.anthropic.com → Settings → API Keys → Create Key**.
2. Copy the key (starts with `sk-ant-`).
3. Set it as `ANTHROPIC_API_KEY` (see [§4 Where to paste](#4-where-to-paste-the-keys)).

_Optional:_ `GEN_MODEL` overrides the model (default `claude-opus-5`; `claude-sonnet-5` is faster/cheaper).

## 2. Buffer (LinkedIn publishing) → `BUFFER_ACCESS_TOKEN` + `BUFFER_LINKEDIN_CHANNEL_ID`

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

## 3. Email (newsletter) → `RESEND_API_KEY` + `EMAIL_FROM` (+ `EMAIL_RECIPIENTS`)

Default provider is **Resend** (simplest). To use SendGrid instead, set `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY`.

1. Create a **Resend** account → **API Keys → Create** → copy → `RESEND_API_KEY`.
2. **Verify a sender domain** (Resend → Domains → add DNS records). Until DNS propagates you can test with Resend's sandbox sender.
3. Set `EMAIL_FROM`, e.g. `Munshot Intelligence <news@munshot.io>`.
4. _Optional:_ set `EMAIL_RECIPIENTS` to your default network list (comma/newline separated). You can also paste recipients per-send in Studio. Recipients are always **BCC'd**, so they never see each other.

## 4. Security (recommended) → `APP_SECRET`

Your publish/send endpoints spend money and post publicly, so lock them down: set `APP_SECRET` to any long random string. When set, Studio shows an **"App secret"** field — paste the same value there once (stored in your browser). Without `APP_SECRET` the endpoints are open (fine for local testing, not for a public URL).

---

## 4. Where to paste the keys

**Cloudflare dashboard → Workers & Pages → `munshot-content-system` → Settings → Variables and Secrets.**

- Add each variable, choose **Secret** (encrypted) for anything sensitive, and apply to **Production** (and **Preview** if you use preview deploys).
- **Redeploy** (push to `main`, or re-run the deploy) so Functions pick up the new values.

| Variable | Required | What it is |
|---|---|---|
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

## 5. Test it

1. Open your deployed site → **Studio** tab.
2. The **Connections** panel should show green dots for **AI**, **LinkedIn (Buffer)**, **Email** once wired. (Any grey dot names the missing key.)
3. Paste a finance post + a dashboard data point → **Generate**. You should see a LinkedIn post and a newsletter preview in a few seconds.
4. **Publish** → check it appears in your Buffer queue / on the Munshot LinkedIn page.
5. Put your own address in **Recipients** → **Send to list** → confirm it lands in your inbox.

If a step errors, the exact reason is shown inline (e.g. "BUFFER_LINKEDIN_CHANNEL_ID is not set").

---

## 6. Run it locally (optional)

Pure UI (no live backend): `npm run dev` → http://localhost:5173 (the Studio buttons will report "backend not reachable", which is expected).

Full stack with the API:

```bash
cp .dev.vars.example .dev.vars   # fill in your keys
npm run dev:api                  # builds, then serves app + functions via wrangler
```

`.dev.vars` is gitignored — real keys never get committed.

---

## Endpoint reference

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | which integrations are wired (booleans only) |
| `/api/generate` | POST | source → `{ linkedin, email }` |
| `/api/publish-linkedin` | POST | push a post to the LinkedIn page via Buffer |
| `/api/send-email` | POST | send the newsletter to the list |
| `/api/buffer-channels` | GET | list Buffer channels (needs `BUFFER_ORG_ID`) |

## Honest limits (so there are no surprises)

- **"Scan the top-20 influencers automatically" isn't possible via any official LinkedIn API** — there's no endpoint to read other people's posts. The workflow is *curate the standout post → the engine does the rest*. (A paid scraper could feed this later, but it breaks LinkedIn's ToS.)
- **Company-page auto-posting works today only because Buffer holds the approved integration.** LinkedIn's own API would require Community-Management-API approval first.
- **Email "from your domain"** needs one-time DNS verification; sandbox sending works immediately.
