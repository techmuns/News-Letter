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
npm run dev            # http://localhost:5173 — UI only, no /api routes
npm run dev:functions  # builds, then serves the app *with* the Pages Functions
npm run build          # typecheck + production build to dist/
npm run preview        # preview the production build
```

`vite dev` does not run the `functions/` directory, so `/api/generate` 404s there
and the app falls back to its deterministic composer. To exercise the real model
locally, use `npm run dev:functions` with the key in a `.dev.vars` file — see
[Vision-based document analysis](#vision-based-document-analysis-openai) below.

### Project structure

```
src/
  components/          reusable primitives (Card, StatusDot, ChannelChips, Menu…)
    workspace/         Workspace pieces (DropZone, MaterialRow, SourcePicker)
    preview/           channel renderers (LinkedInPost, EmailPreview, ArticlePreview)
  spaces/              the four routed spaces
  store/useStore.ts    shared Zustand store + mocked actions
  lib/ai.ts            the browser's side of the model call
  lib/sanitize.ts      strips brief metadata out of model output
  data/mockData.ts     seeded, value-first mock content
  types.ts             Campaign / ChannelVersion / WorkspaceItem model
functions/
  api/generate.js      Cloudflare Pages Function — the only place OpenAI is called
  api/read.js          server-side article reader for pasted links
```

---

## Vision-based document analysis (OpenAI)

Uploads are **read**, not just displayed. A screenshot of a results page, a slide,
a dashboard grab or a scanned PDF goes to a vision-capable OpenAI model together
with the author's own instructions, and the post is written from what the document
actually says.

### The two calls

Both go through [`functions/api/generate.js`](functions/api/generate.js), which is
the only place the API key is ever used — it lives on the server, never in the
browser bundle.

| When | Mode | What is sent in **one** request |
| --- | --- | --- |
| A file is dropped into the Workspace | `analyze` | the image + what the author is working towards → a transcription that becomes the material's text |
| **Generate the post** is clicked | `compose` | the images **and** the extracted document text **and** the author's write-up **and** the brief-as-directives → the three channel drafts |

The images travel as `image_url` parts on the same user message as the prompt, at
`detail: "high"`. The upload and the instructions are never split across two calls.

Downstream, nothing else changed shape: once an image has been read, its text is a
normal material, so the step-one write-up, the sourced-quote list and the playbook
check all work on screenshots exactly as they already did on PDFs.

### Environment variables

Set these in the Cloudflare dashboard → your Pages project → **Settings →
Environment variables** (Production, and Preview if you want preview deploys to
work too). Add them as **plaintext** except the key, which should be **Encrypted**.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | **yes** | — | Your OpenAI key (`sk-…`). Mark it **Encrypt**. |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Any vision-capable chat model your key can use. A model the key's project can't reach falls back to `gpt-4o-mini` automatically. |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | Point at a compatible gateway or proxy. |
| `OPENAI_MAX_IMAGES` | no | `3` | Images per request — each one is billed. |
| `OPENAI_IMAGE_DETAIL` | no | `auto` | `low` \| `auto` \| `high`. The biggest cost lever — see below. |
| `OPENAI_MAX_DOC_CHARS` | no | `12000` | Extracted document text per request. A long PDF is silently the most expensive input. |
| `OPENAI_READ_ON_UPLOAD` | no | `true` | `false` reads an upload only at generation time — one billed call instead of two. |
| `OPENAI_MAX_OUTPUT_TOKENS` | no | `3000` | Safety ceiling on the answer. Not a budget — you pay for what is generated. |
| `OPENAI_ORG` / `OPENAI_PROJECT` | no | — | Sent as `OpenAI-Organization` / `OpenAI-Project` headers. |

> **The name matters.** It must be exactly `OPENAI_API_KEY`. Do **not** prefix it
> with `VITE_` — anything named `VITE_*` is compiled into the JavaScript the
> browser downloads, which would publish your key to every visitor.

Environment-variable changes only take effect on a **new build**, so push a commit
or hit **Retry deployment** after adding them.

For local development, put the same values in a `.dev.vars` file at the repo root
(it is git-ignored) and run `npm run dev:functions`:

```
OPENAI_API_KEY=sk-…
OPENAI_MODEL=gpt-4o
```

### What it costs, and how to keep it cheap

The OpenAI API is **pay-per-use and billed separately from ChatGPT** — a ChatGPT
subscription includes no API credit. Every call below is charged on tokens in +
tokens out, and images are the expensive part.

**Set a spend limit in the OpenAI dashboard (Settings → Limits) before demoing.**
That is the only hard cap. Everything below reduces spend; nothing below
guarantees it.

One billed call per action:

| Action | Calls |
| --- | --- |
| Drop an image | 1 (`analyze`) — none if `OPENAI_READ_ON_UPLOAD=false` |
| Drop a scanned PDF | 1, carrying up to 2 rendered pages |
| Drop a PDF that has a text layer | **0** — parsed in the browser |
| Paste a link | **0** — fetched by `/api/read` |
| **Generate the post** | 1 (`compose`) |
| **Regenerate** | 1 more, every time |

So the default demo path — drop a screenshot, generate — is **2 calls**.

Cheapest sane demo settings:

```
OPENAI_IMAGE_DETAIL=low       # flat, much smaller image charge
OPENAI_READ_ON_UPLOAD=false   # 2 calls become 1
OPENAI_MAX_IMAGES=1
OPENAI_MAX_DOC_CHARS=6000
```

`low` renders the image small before the model looks at it. On a chart or a
slide with large type it reads fine; on a dense table in 9pt it will start
missing digits, and a wrong figure is worse than an expensive one. Test your
actual demo document at `low` before the demo, and fall back to `auto` if it
misreads. `gpt-4o-mini` is the default `OPENAI_MODEL` — much cheaper per token
and vision-capable — but verify it on a real report page: the writing is far
cheaper, while an image can still cost about the same as it would on `gpt-4o`.

Two things stop a runaway rather than trim a bill:

- The browser stops making calls after **60 in one tab** and says so; a reload
  clears it. That catches a stuck loop or a demo left open, not deliberate use.
- Every draft's **Read by the model** card shows the tokens in and out and how
  many calls the session has made, so the cost is visible while you demo rather
  than a surprise on the invoice.

With `OPENAI_API_KEY` unset the app spends nothing at all and still demos the
full flow — it just composes the drafts locally instead of reading the upload.

### Package dependencies

**None were added.** The Pages Function calls the OpenAI REST API with the
`fetch` that is already in the Workers runtime, so there is no `openai` package,
no SDK and nothing extra in the browser bundle. The only new dev dependency is
`wrangler`, and that is purely so `npm run dev:functions` can serve the functions
locally — it is not needed to build or deploy.

### Checking that the image really is being sent

"Uploaded" and "reached the model" are different things, so the app reports the
second one rather than asking you to take its word for it:

1. **In the app.** Every generated draft carries a **Read by the model** card
   showing the model id, how many images were transmitted and their size, how many
   documents and characters went with them, and the prompt-token count — all
   counted server-side from the request that was actually sent. If it says
   `0 images sent`, the draft in front of you was not written from your upload,
   and it says so in amber.
2. **In the browser.** DevTools → Network → the `POST /api/generate` request →
   Payload. The `images[].dataUrl` is the file itself, base64-encoded.
3. **On the edge.** `npx wrangler pages deployment tail` streams the function's
   logs; failures log as `[api/generate] compose <reason>`.
4. **Is it wired up at all?** `curl https://<your-site>/api/generate` returns
   `{"configured":true,"model":"gpt-4o-mini",…}` when the key is set.

### What it will not do

- **It will not write around an unreadable upload.** If the model looks and finds
  no legible text or data, no draft is created at all — the Workspace tells you
  what it saw instead. A confident post about a blurred scan is the failure mode
  this exists to prevent.
- **It will not put the brief in the copy.** The audience, tone, objective and
  format are sent as instructions on *how* to write and are explicitly banned from
  appearing in what is written. Anything that slips through — `(Written for VC)`,
  `Target Audience:`, `[insert figure]`, markdown asterisks — is stripped by
  [`src/lib/sanitize.ts`](src/lib/sanitize.ts) before the draft is stored.
  Parentheses carrying facts, like `(FY25)`, are left alone.
- **It will not invent figures.** Every number is supposed to come from the
  supplied material, and the draft lists the specific facts it used so they can be
  checked against the document.
- **It will not break without a key.** With `OPENAI_API_KEY` unset the app behaves
  exactly as it did before: the deterministic composer writes the drafts from your
  write-up, and the Workspace says the uploads were not read.

---

## Deployment — already automated

Every push to **`main`** builds and deploys to **Cloudflare Pages** automatically.
Cloudflare watches this repo directly through its Git integration — there is no
GitHub Action and no API token to manage.

Live: **https://news-letter-7jx.pages.dev**

The settings live in the Cloudflare dashboard (**Workers & Pages →
`news-letter-7jx` → Settings → Build**) and are already configured:

| Setting               | Value                |
| --------------------- | -------------------- |
| Git repository        | `techmuns/News-Letter` |
| Production branch     | `main`               |
| Automatic deployments | Enabled              |
| Build command         | `npm run build`      |
| Build output          | `dist`               |

Pushing to `main` is the whole workflow. Other branches get their own preview
URLs. Build status and per-commit logs are under the project's **Deployments**
tab — that's the place to look if a deploy doesn't land, not GitHub Actions.

Client-side routes are handled by [`public/_redirects`](public/_redirects)
(`/* /index.html 200`).

### Optional: password-protect the site

[`functions/_middleware.js`](functions/_middleware.js) is a Cloudflare Pages
Function that gates every route behind a single shared password (HTTP Basic
Auth), so the whole site — not just individual pages — needs it before
anything loads.

It's **inert until you set it up** — deploying this file alone changes
nothing:

1. Cloudflare dashboard → your Pages project → **Settings → Environment
   variables** → add `SITE_PASSWORD` (mark it **Encrypt**) for Production
   (and Preview, if you want previews locked too).
2. Redeploy (push again, or **Retry deployment** in the dashboard) — env var
   changes need a new build to take effect.
3. Visiting the site now prompts the browser's native login dialog; any
   username works, only the password is checked.

To change the password later, update `SITE_PASSWORD` and redeploy. To remove
the lock, delete the env var and redeploy (the function no-ops with no
password set).

---

## What Phase 1 deliberately does **not** build

Real file parsing · a real LLM agent (the "Turn into content" action spawns pre-written
mock drafts) · LinkedIn/email/CMS integrations · email sending · real auth. Those come
in later phases and plug into this foundation.
