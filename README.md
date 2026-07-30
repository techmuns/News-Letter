# Munshot Content System — Phase 1 UI

An **intelligence console** for turning Munshot's own dashboards, data and research
into investor-grade content, published across three channels: **LinkedIn**, **email
newsletter**, and **long-form article**.

> **Phase 1 = the UI shell on mock data**, with one real pipeline wired in early:
> **"Turn into content"** now calls Firecrawl (to crawl any linked source) and
> Genspark (to draft the LinkedIn/Email/Article copy) when their API keys are
> configured — see [Real content pipeline](#real-content-pipeline-firecrawl--genspark)
> below. Everything else (uploads processing, publishing, scheduling) is still
> mocked. The goal is the *look*, the *navigable structure*, and the *four spaces*
> populated with realistic content — a foundation later phases plug real pipelines into.

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
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
npm run preview  # preview the production build
```

### Project structure

```
src/
  components/          reusable primitives (Card, StatusDot, ChannelChips, Menu…)
    workspace/         Workspace pieces (DropZone, PileItemCard, CampaignsRail)
    preview/           channel renderers (LinkedInPost, EmailPreview, ArticlePreview)
  spaces/              the four routed spaces
  store/useStore.ts    shared Zustand store + mocked actions
  data/mockData.ts     seeded, value-first mock content
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

## Real content pipeline (Firecrawl + Genspark)

"Turn into content" runs through a small Cloudflare Pages Function
([`functions/api/turn-into-content.ts`](functions/api/turn-into-content.ts)) instead
of the frontend, so the API keys never reach the browser bundle:

1. **Firecrawl** ([`functions/lib/firecrawl.ts`](functions/lib/firecrawl.ts)) crawls any
   linked sources (paste a link in the Workspace drop zone) into clean markdown —
   built against Firecrawl's [documented `/v2/scrape` endpoint](https://docs.firecrawl.dev/api-reference/endpoint/scrape).
2. **Genspark** ([`functions/lib/genspark.ts`](functions/lib/genspark.ts)) drafts the
   LinkedIn / Email / Article copy from the combined source material.
   > ⚠️ Genspark has no publicly documented developer API — access is gated behind
   > enterprise sales with no published REST spec. `functions/lib/genspark.ts` is
   > written against a best-effort assumed contract (OpenAI-compatible chat
   > completions) and isolated so it's the **only file to change** once you have
   > your account's real endpoint/request/response shape.

If either key is missing or a call fails, the Workspace falls back to the existing
mocked template (a console warning notes why) — the UI never breaks.

### Configuration

Add these as **Cloudflare Pages** secrets (dashboard → project → **Settings →
Environment variables**, or `wrangler pages secret put <NAME>`):

- `FIRECRAWL_API_KEY`
- `GENSPARK_API_KEY`

For local testing, copy [`.dev.vars.example`](.dev.vars.example) to `.dev.vars`
(gitignored), fill in real keys, then:

```bash
npm run build
npm run functions:dev   # wrangler pages dev — serves dist/ + functions/ together
```

`npm run dev` (plain Vite) does **not** run the Pages Functions — calls to
`/api/turn-into-content` will 404 and the Workspace silently falls back to mock
drafts, which is expected for day-to-day UI work.

---

## What Phase 1 deliberately does **not** build

Real file/PDF parsing · publishing to LinkedIn/email/CMS · email sending · real auth.
Those come in later phases and plug into this foundation.
