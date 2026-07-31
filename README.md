# Munshot Content System — Phase 1 UI

An **intelligence console** for turning Munshot's own dashboards, data and research
into investor-grade content, published across three channels: **LinkedIn**, **email
newsletter**, and **long-form article**.

> **Phase 1 = the UI shell on mock data**, with one real pipeline running through it:
> the **auto-generator**, which scrapes what real finance writers actually published
> and composes drafts from their own words. Uploads, publishing and auth are still
> mocked. The goal is the *look*, the *navigable structure*, and the *four spaces*
> populated with real content — a foundation later phases plug more pipelines into.

---

## The four spaces

| # | Space | What it is |
|---|-------|------------|
| 01 | **Workspace** (home) | A shared desk where the team drops raw material — PDFs, screenshots, notes. Select items → **Turn into content** → a Campaign with three linked channel drafts. |
| 02 | **LinkedIn** | Post drafts, one per campaign. Click to preview exactly as it appears in-feed. |
| 03 | **Email** | The weekly newsletter schedule (Mon insight · Wed story · Fri actionable). Click to preview as it lands in the inbox. |
| 04 | **Articles** | Long-form drafts, each ending in a relevant Munshot pointer. |

## The one mechanic that matters

One **master Campaign** → **three linked channel versions** (LinkedIn / Email / Article).

- All three stay linked to the campaign, surfaced everywhere as three status dots.
- **Each channel version has its own independent status** — editing one never touches the others.
- **A manual edit is never silently overwritten.** Once a version is marked *edited*,
  a re-generate must be explicitly confirmed before it overwrites.
- Statuses (per channel): `Idea → Draft → In Review → Ready → Scheduled → Published`.

---

## The auto-generator

The Workspace's **signal feed** reads what real finance writers just published and
drops those posts into the pile as source material. Selecting one and hitting
**Turn into content** composes the three channel drafts *from that post's own text*.

**Where it reads.** A roster of named finance people
([`shared/voices.ts`](shared/voices.ts)) — Deepak Shenoy, Nithin Kamath, Saurabh
Mukherjea and Ajay Shah on the India side; Aswath Damodaran, Howard Marks, Marc
Rubinstein, Morgan Housel, Ben Carlson and others globally — each pointed at their
own blog or newsletter, where the thinking lands first.

> **Not LinkedIn.** LinkedIn serves an auth wall to every crawler and its terms
> forbid scraping, so a LinkedIn URL would return a login page, not a post. These
> people publish the same arguments on their own sites, which is what we read.

**How it reads.** Two Firecrawl v2 calls, both server-side:

| Step | Call | What it does |
|---|---|---|
| Discover | `POST /v2/scrape` with the `json` format | One call per voice: extracts their latest posts (title, url, date, excerpt) from the listing page |
| Deep read | `POST /v2/scrape` with `markdown` | On demand, for the one post you're turning into content |

Discovery is cheap and cached (`maxAge` 6h); the expensive full read only happens
for posts you actually use.

**How it composes.** [`src/lib/compose.ts`](src/lib/compose.ts) is deterministic —
same post in, same draft out. It scores the post's sentences for standalone
argument, headline relevance and position; pulls figures **only from the lines it
quotes**, so evidence and claim are always the same passage; and matches the post
to the right Munshot product by headline and sustained body coverage rather than
stray keyword hits.

Everything the source said is quoted and attributed. Everything Munshot adds is
prefixed *"Our read:"*, so the two never blur — and every draft carries a
**Sourced from** strip with author, publication and a link, visible to whoever
approves it.

**Auto-draft.** Toggle it on and each harvest turns its first few new posts into
campaigns automatically (capped per run). Off by default.

### Connecting Firecrawl

The key is read only by the `/api` routes and is never inlined into the client
bundle (it is deliberately *not* `VITE_`-prefixed).

```bash
cp .env.example .env      # then add your key from https://firecrawl.dev
npm run dev
```

Without a key the app runs fine and says so plainly — the signal feed shows
**Firecrawl not connected** and scrapes nothing. It never invents posts or
attributes words to a real person that they did not write.

For production, add `FIRECRAWL_API_KEY` as a Cloudflare Pages secret
(**Workers & Pages → your project → Settings → Variables and Secrets**, encrypted).

---

## Tech

- **React + Vite + TypeScript + Tailwind CSS**
- **React Router** for the four spaces
- **Zustand** (+ `localStorage`) for the shared store holding workspace items,
  campaigns, and channel versions — so the campaign linkage is consistent across spaces
- Dark **"Channel Probe" design system** (near-black base, violet accent, restrained
  glass, monospace micro-labels, status dots). Design tokens live in
  [`src/index.css`](src/index.css) and [`tailwind.config.js`](tailwind.config.js).

### Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
npm run preview  # preview the production build
```

### Project structure

```
shared/                imported by both client and server
  voices.ts            the roster of real finance writers + their public URLs
  harvest.ts           HarvestedPost + the /api request/response contract
server/
  firecrawl.ts         Firecrawl v2 calls, normalisation, roster URL guard
  http.ts              response helpers shared by both API runtimes
functions/api/         Cloudflare Pages Functions — /api/harvest, /api/read
src/
  components/          reusable primitives (Card, StatusDot, ChannelChips, Menu…)
    workspace/         Workspace pieces (DropZone, SignalFeed, PileItemCard, CampaignsRail)
    preview/           channel renderers (LinkedInPost, EmailPreview, ArticlePreview)
  spaces/              the four routed spaces
  lib/compose.ts       the auto-generator — real post → three channel drafts
  lib/harvestClient.ts browser-side wrapper for the /api routes
  store/useStore.ts    shared Zustand store, harvest + generation actions
  data/mockData.ts     seeded, value-first mock content
  types.ts             Campaign / ChannelVersion / WorkspaceItem model
```

The same handlers back both runtimes: [`vite.config.ts`](vite.config.ts) mounts
them as dev middleware, `functions/api/*` deploys them to Cloudflare. One API
contract, one place to change.

---

## Deployment — configure once, automated forever

Every push to **`main`** builds and deploys to **Cloudflare Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Build command is
`npm run build`; output directory is `dist/`.

### One-time setup (≈ 3 minutes, then hands-off)

1. **Create the Cloudflare Pages project** (once):
   - Cloudflare dashboard → **Workers & Pages → Create → Pages → Create using direct upload**.
   - Name it exactly **`munshot-content-system`** (must match `--project-name` in the workflow).
   - You can skip uploading anything now — the GitHub Action will push the first real build.
2. **Create a Cloudflare API token**: dashboard → **My Profile → API Tokens → Create Token**
   → use the **"Edit Cloudflare Workers"** template (it includes Pages), scoped to your account.
3. **Add two GitHub repository secrets** (repo → **Settings → Secrets and variables → Actions**):
   - `CLOUDFLARE_API_TOKEN` — the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard URL or the Pages project overview
4. **Add the Firecrawl secret to the Pages project** (not to GitHub — it is read at
   request time by the Functions, not at build time): project → **Settings →
   Variables and Secrets → Add → Secret**, named `FIRECRAWL_API_KEY`.

That's it. From then on, every push to `main` deploys automatically — no manual steps.

> **Simpler alternative (no secrets):** instead of the GitHub Action, connect the repo
> directly in Cloudflare Pages (**Create → Pages → Connect to Git**), set build command
> `npm run build` and output directory `dist`. Then delete `.github/workflows/deploy.yml`.
> Both approaches are "configure once."

Client-side routes are handled by [`public/_redirects`](public/_redirects)
(`/* /index.html 200`).

---

## What Phase 1 deliberately does **not** build

Real file parsing · an LLM writing pass (the composer is deterministic — that is the
seam an LLM slots into) · LinkedIn/email/CMS integrations · email sending · real auth.
Those come in later phases and plug into this foundation.

Pile items that are *not* harvested posts (PDFs, screenshots, notes) still generate
from the pre-written mock templates in [`src/data/mockData.ts`](src/data/mockData.ts).
Only real scraped posts drive the real composer.
