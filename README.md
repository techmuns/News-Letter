# Munshot Content System — Phase 1 UI

An **intelligence console** for turning Munshot's own dashboards, data and research
into investor-grade content, published across three channels: **LinkedIn**, **email
newsletter**, and **long-form article**.

> **Phase 1 = the UI shell on mock data.** No real integrations, no real agent, no
> real uploads processing, no publishing. Everything is mocked. The goal is the
> *look*, the *navigable structure*, and the *four spaces* populated with realistic
> content — a foundation later phases plug real pipelines into.

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
cp .env.example .env   # then paste your Firecrawl key in (optional — see below)
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
npm run preview  # preview the production build
```

> `npm run preview` serves the built SPA only — it does **not** run Pages
> Functions, so `/api/scrape` is unavailable there. Use `npm run dev` to
> exercise scraping locally.

---

## Pulling real LinkedIn posts (Firecrawl)

The Workspace drop zone has a second input: paste a LinkedIn **post permalink**,
a **profile** (`/in/…`) or a **company** (`/company/…`) URL and the posts land in
the pile as real source material, ready to select and turn into content. Each
scraped item keeps its permalink, author and engagement counts, and links back to
the original rather than replacing it.

### The key never touches the browser

`FIRECRAWL_API_KEY` is deliberately **not** a `VITE_` variable — Vite inlines
those into the client bundle, where anyone could read it off the deployed site.
Instead the browser calls our own `/api/scrape`, which holds the key server-side:

| | serves `/api/scrape` | reads the key from |
|---|---|---|
| `npm run dev` | Vite middleware in [`vite.config.ts`](vite.config.ts) | `.env` (gitignored) |
| deployed | [`functions/api/scrape.ts`](functions/api/scrape.ts) | Pages env var |

Both call the same handler in `src/lib/firecrawl.server.ts`, so local and
production cannot drift apart. To set it in production: Cloudflare dashboard →
your Pages project → **Settings → Environment variables** → add
`FIRECRAWL_API_KEY`. Wrangler uploads the root `functions/` directory
automatically, so no workflow change is needed.

### LinkedIn blocks scrapers — expect partial results

This is worth stating plainly rather than discovering in a demo: LinkedIn
answers unauthenticated scrapers with a sign-in wall, and it returns that wall
as a **200, not an error**. So the feature is built to be honest about it:

- An authwall is detected and **never filed into the pile as content**.
- **Post permalinks are the most reliable** thing to scrape. Profile and company
  feed pages are gated much harder — a profile scrape that returns nothing is a
  normal outcome, not a bug.
- A profile/company scrape costs **one Firecrawl credit per post** plus one for
  the index page, which is why the count is capped (3/5/10, default 5).
- Partial failures are surfaced, not swallowed — "2 of 5 posts came back blocked
  or empty" appears under the input.

If a URL is not a LinkedIn URL, it is rejected client-side before any credit is
spent.

### Project structure

```
functions/
  api/scrape.ts        POST /api/scrape — Cloudflare Pages Function (production)
src/
  components/          reusable primitives (Card, StatusDot, ChannelChips, Menu…)
    workspace/         Workspace pieces (DropZone, PileItemCard, CampaignsRail,
                       LinkedInImport)
    preview/           channel renderers (LinkedInPost, EmailPreview, ArticlePreview)
  spaces/              the four routed spaces
  store/useStore.ts    shared Zustand store + mocked actions
  data/mockData.ts     seeded, value-first mock content
  lib/linkedin.ts      LinkedIn URL parsing + Firecrawl output → post (pure)
  lib/firecrawl.server.ts   Firecrawl client — SERVER ONLY, holds the key
  lib/scrapeApi.ts     browser client for /api/scrape
  types.ts             Campaign / ChannelVersion / WorkspaceItem model
```

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

That's it. From then on, every push to `main` deploys automatically — no manual steps.

> **Simpler alternative (no secrets):** instead of the GitHub Action, connect the repo
> directly in Cloudflare Pages (**Create → Pages → Connect to Git**), set build command
> `npm run build` and output directory `dist`. Then delete `.github/workflows/deploy.yml`.
> Both approaches are "configure once."

Client-side routes are handled by [`public/_redirects`](public/_redirects)
(`/* /index.html 200`).

---

## What Phase 1 deliberately does **not** build

Real file parsing · a real LLM agent (the "Turn into content" action spawns pre-written
mock drafts) · publishing to LinkedIn/email/CMS · email sending · real auth. Those come
in later phases and plug into this foundation.

**Now real:** pulling posts *in* from LinkedIn via Firecrawl (above). Everything
downstream of the pile — generation, the three channel drafts — is still mocked, so a
scraped post currently seeds a pre-written campaign rather than one written from it.
