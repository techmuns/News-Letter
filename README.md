# Munshot Content System

An **intelligence console** for turning Munshot's own research, dashboards and notes
into investor-grade content, published across three channels: **LinkedIn**, **email
newsletter**, and **long-form article**.

The app starts empty. Everything in it comes from material your team uploads and
from drafts generated against that material — there is no seeded or sample content.

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
  **Re-draft all three** asks for explicit confirmation before replacing it.
- Statuses (per channel): `Idea → Draft → In Review → Ready → Scheduled → Published`.

---

## How generation works

1. Files you drop are stored **locally in your browser** (IndexedDB for the bytes,
   `localStorage` for the metadata). Nothing is uploaded on drop.
2. Pressing **Turn into content** posts the selected items to `/api/generate`, a
   Cloudflare Pages Function.
3. That function calls the **OpenAI Responses API** server-side, attaching PDFs and
   images so the model reads the actual source material, and constrains the reply
   with a JSON Schema (Structured Outputs) matching the three-channel shape.
4. The draft comes back and becomes a Campaign with all three channels `In Review`.

**The OpenAI key never reaches the browser.** It is read from the Pages environment
inside the function; the browser only ever talks to `/api/generate`.

### What the model is told

The system prompt in [`functions/api/generate.ts`](functions/api/generate.ts)
requires every figure, company, date and claim to come from the supplied material,
and forbids inventing specifics when the source is thin. If a draft contains a
number you can't find in your own source file, treat that as a bug worth reporting.

### Limits

- 8 MB per file, ~24 MB per generation request (the upstream ceiling is 50 MB of
  files per request, and base64 inflates payloads by about a third).
- PDFs and PNG/JPEG/WebP/GIF images are read by the model. Other file types are
  stored and listed for context, but their contents are not sent.

---

## Tech

- **React + Vite + TypeScript + Tailwind CSS**
- **React Router** for the four spaces
- **Zustand** (+ `localStorage`) for workspace items, campaigns and channel versions
- **IndexedDB** for file payloads (`src/lib/fileStore.ts`) — `localStorage` caps out
  around 5 MB, which a single PDF exceeds
- **Cloudflare Pages Functions** for the server-side generation endpoint
- Dark **"Channel Probe" design system**. Design tokens live in
  [`src/index.css`](src/index.css) and [`tailwind.config.js`](tailwind.config.js).

### Project structure

```
functions/api/generate.ts   the server-side OpenAI call (the key lives here)
src/
  components/               reusable primitives (Card, StatusDot, ChannelChips…)
    workspace/              Workspace pieces (DropZone, PileItemCard, CampaignsRail)
    preview/                channel renderers (LinkedInPost, EmailPreview, ArticlePreview)
    editor/                 the per-channel editor
  spaces/                   the four routed spaces
  store/useStore.ts         shared Zustand store
  lib/fileStore.ts          IndexedDB payload storage
  lib/generate.ts           client half of the generation call
  config.ts                 brand identity, promotions, upload limits — edit this
  types.ts                  Campaign / ChannelVersion / WorkspaceItem model
```

### Configure before you use it

[`src/config.ts`](src/config.ts) holds real configuration, not sample data. Check it:

- `BRAND` — the name, tagline and email "from" shown in previews.
- `PROMOTIONS` — the products a campaign may point at. **Edit this to match the
  products you actually sell.** An empty list is valid; campaigns then carry no pointer.

---

## Local development

```bash
npm install

# Terminal 1 — the UI
npm run dev          # http://localhost:5173

# Terminal 2 — the /api/generate function
npm run dev:api      # http://localhost:8788, proxied from the Vite dev server
```

Generation needs a key locally. Create a **`.dev.vars`** file in the project root
(already gitignored):

```
OPENAI_API_KEY=sk-...
# optional — defaults to gpt-5.6
OPENAI_MODEL=gpt-5.6
```

Running only `npm run dev` gives you the whole UI; pressing **Turn into content**
will report that the endpoint isn't running.

```bash
npm run build    # typecheck (app + functions) + production build to dist/
npm run preview  # preview the production build
npm run lint     # typecheck only
```

---

## Deployment — configure once, automated forever

Every push to **`main`** builds and deploys to **Cloudflare Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Build command is
`npm run build`; output directory is `dist/`. The `functions/` directory at the repo
root is picked up automatically and deployed alongside the static build.

### One-time setup

1. **Create the Cloudflare Pages project** (once):
   - Cloudflare dashboard → **Workers & Pages → Create → Pages → Create using direct upload**.
   - Name it exactly **`munshot-content-system`** (must match `--project-name` in the workflow).
2. **Create a Cloudflare API token**: dashboard → **My Profile → API Tokens → Create Token**
   → use the **"Edit Cloudflare Workers"** template (it includes Pages), scoped to your account.
3. **Add two GitHub repository secrets** (repo → **Settings → Secrets and variables → Actions**):
   - `CLOUDFLARE_API_TOKEN` — the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard URL or the Pages project overview
4. **Add the OpenAI key to Cloudflare** (this is what makes generation work in production):
   - Pages project → **Settings → Variables and secrets** → add a **secret** named
     `OPENAI_API_KEY`. Add it to both the Production and Preview environments if you
     use preview deployments.
   - Optionally add `OPENAI_MODEL` as a plain variable to override the default.
   - Redeploy after adding it — secrets are bound at deploy time.

Without step 4 the app still loads, and **Turn into content** returns a clear message
saying the key is missing rather than failing silently.

Client-side routes are handled by [`public/_redirects`](public/_redirects)
(`/* /index.html 200`).

---

## Not built yet

Publishing is not wired up. Approving and scheduling a channel moves it through the
statuses inside this tool — it does **not** post to LinkedIn, send email, or push to
a CMS. Those need, respectively: LinkedIn Marketing Developer Platform approval for
your company page, an ESP integration, and a CMS API. The status flow is the
foundation those plug into.
