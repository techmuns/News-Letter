// Cloudflare Pages Function — the one place a model is called.
//
// Two things happen here, both against a vision-capable OpenAI model, and both
// in a single request each:
//
//   mode: 'analyze'  one uploaded image + the author's instructions → what the
//                    document actually says. This is how a screenshot, a slide
//                    or a scanned page becomes readable material instead of a
//                    thumbnail the app can only display.
//   mode: 'compose'  the images AND the extracted document text AND the
//                    author's own write-up → the three channel drafts.
//
// The images travel with the prompt in the same chat completion, as image_url
// parts on one user message, so the model reads the document before it writes a
// word of the post. Nothing in the payload is a filename standing in for a file.
//
// The key never reaches the browser: the client posts to this route on our own
// origin and this route holds OPENAI_API_KEY. With no key configured the route
// says so and the app falls back to its deterministic composer.

const DEFAULT_MODEL = 'gpt-4o'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/** Images per request. Each one is billed, so the cap is deliberate. */
const DEFAULT_MAX_IMAGES = 6
/** Extracted document text carried into the prompt, per request. */
const MAX_DOC_CHARS = 60_000
/** Guard against a runaway upload — ~8 MB of base64 is already a lot of pixels. */
const MAX_IMAGE_CHARS = 8_000_000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function config(env) {
  return {
    key: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || DEFAULT_MODEL,
    baseUrl: (env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    maxImages: Math.max(1, Number(env.OPENAI_MAX_IMAGES) || DEFAULT_MAX_IMAGES),
    org: env.OPENAI_ORG || '',
    project: env.OPENAI_PROJECT || '',
  }
}

/* ---- the model call ------------------------------------------ */

/**
 * One chat completion, JSON back.
 *
 * `temperature` and `max_tokens` are rejected by some newer models, so a 400
 * naming one of them is retried once without it rather than surfacing as
 * "generation failed" to the author.
 */
async function chat(cfg, { system, content, maxTokens }) {
  const body = {
    model: cfg.model,
    temperature: 0.4,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      // One message, every part: the instructions, the document text, and the
      // images themselves. This is the request that has to carry the upload.
      { role: 'user', content },
    ],
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        ...(cfg.org ? { 'OpenAI-Organization': cfg.org } : {}),
        ...(cfg.project ? { 'OpenAI-Project': cfg.project } : {}),
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content ?? ''
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('The model did not return usable JSON.')
      }
      return { parsed, usage: data?.usage ?? null, model: data?.model ?? cfg.model }
    }

    const detail = await res.text()
    // Newer models reject the sampling params rather than ignoring them.
    if (res.status === 400 && /max_tokens/.test(detail) && body.max_tokens !== undefined) {
      body.max_completion_tokens = body.max_tokens
      delete body.max_tokens
      continue
    }
    if (res.status === 400 && /temperature/.test(detail) && body.temperature !== undefined) {
      delete body.temperature
      continue
    }
    throw new Error(openAiMessage(res.status, detail))
  }
  throw new Error('The model rejected the request.')
}

/** Turns an OpenAI error body into a line the author can act on. */
function openAiMessage(status, detail) {
  let message = ''
  try {
    message = JSON.parse(detail)?.error?.message ?? ''
  } catch {
    message = ''
  }
  if (status === 401) return 'OpenAI rejected the API key — check OPENAI_API_KEY.'
  if (status === 404 && /model/i.test(message)) {
    return `${message} Set OPENAI_MODEL to a vision-capable model your key can use.`
  }
  if (status === 429) return 'OpenAI rate limit or quota reached — try again shortly.'
  return message || `OpenAI returned ${status}.`
}

/* ---- payload validation -------------------------------------- */

/** Keeps only real inline images, capped in count and size. */
function usableImages(raw, max) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (img) =>
        img &&
        typeof img.dataUrl === 'string' &&
        /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(img.dataUrl) &&
        img.dataUrl.length <= MAX_IMAGE_CHARS,
    )
    .slice(0, max)
    .map((img) => ({ name: String(img.name ?? 'image').slice(0, 120), dataUrl: img.dataUrl }))
}

function usableDocuments(raw) {
  if (!Array.isArray(raw)) return []
  let budget = MAX_DOC_CHARS
  const out = []
  for (const doc of raw) {
    if (!doc || typeof doc.text !== 'string' || !doc.text.trim()) continue
    if (budget <= 0) break
    const text = doc.text.slice(0, budget)
    budget -= text.length
    out.push({
      name: String(doc.name ?? 'document').slice(0, 160),
      pages: Number(doc.pages) || undefined,
      text,
    })
  }
  return out
}

/** How much of the upload actually went to OpenAI — reported back as proof. */
function traceOf(images, documents, usage, model) {
  return {
    model,
    imagesSent: images.length,
    imageBytes: images.reduce((n, i) => n + Math.round((i.dataUrl.length * 3) / 4), 0),
    documentsSent: documents.length,
    documentChars: documents.reduce((n, d) => n + d.text.length, 0),
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens: usage?.completion_tokens ?? null,
  }
}

/* ---- shared rules -------------------------------------------- */

// The single most important paragraph in this file. Everything the author
// complained about — generic copy, "(Written for VC)", invented figures — is a
// rule here, stated as a prohibition the model can check its own output against.
const HOUSE_RULES = `HARD RULES — these override every other instruction.

1. READ FIRST. Work through every image and document supplied before writing.
   Read titles, headings, axis labels, legends, table headers, every row and
   column value, footnotes, totals, units, currencies and periods.
2. GROUND EVERYTHING. Every figure, company, person, date, period and claim you
   write must be present in the supplied material. Never supply a number, a name
   or a trend from general knowledge, and never estimate, round differently, or
   extrapolate. If the material does not support a point, leave the point out.
3. NEVER INVENT. If the material is too thin to write from, say so through the
   "readable" field instead of producing something plausible.
4. NO METADATA IN THE COPY. The brief shapes how you write; it is never
   mentioned in what you write. Never emit a label, a tag, a note to the editor,
   a placeholder or an aside describing the assignment. Specifically banned in
   any output field: "(Written for VC)", "(Written for PE)", "Target Audience:",
   "Audience:", "Tone:", "Objective:", "Content type:", "Format:", "Word count:",
   "Headline:", "Body:", "Note:", "Disclaimer:", "[insert …]", "[TBD]", "[X%]".
5. NO SQUARE BRACKETS AT ALL, and no parenthetical that talks about the piece
   rather than the subject. A parenthetical carrying a fact — "(FY25)",
   "(₹3,591 crore)" — is fine.
6. PLAIN TEXT ONLY. No markdown: no **bold**, no ## headings, no backticks. What
   you return is pasted straight into the channel as-is.
7. PUBLICATION-READY. No preamble ("Here is a post about…"), no sign-off asking
   for feedback on the draft, no restating the audience, tone or objective.`

/* ---- mode: analyze ------------------------------------------- */

const ANALYZE_SYSTEM = `You read documents out of images: report pages, screenshots, dashboards, slides, tables, charts, scanned filings.

Transcribe what is actually on the page, in reading order — title, headings, body text, table headers and every row and column value, axis labels, legends, footnotes, totals, dates, units and currencies. Keep every number exactly as printed. For a chart, state the chart type, what each axis and series represents, and the values that can be read off it.

Do not interpret, summarise, editorialise or add anything that is not visible in the image. You are the reading step, not the writing step.

Return JSON only:
{
  "readable": boolean,   // false when the image carries no legible text or data
  "title": string,       // the document's own title, "" when it has none
  "kind": string,        // e.g. "annual report page", "bar chart", "slide", "spreadsheet"
  "text": string,        // the transcription; "" when readable is false
  "reason": string       // when readable is false, what you saw instead
}`

async function analyze(cfg, payload) {
  const images = usableImages(payload.images, cfg.maxImages)
  if (!images.length) return json({ error: 'No readable image was supplied.' }, 400)

  const instructions = String(payload.instructions ?? '').slice(0, 4000).trim()
  const content = [
    {
      type: 'text',
      text: [
        `Read ${images.length === 1 ? 'this document' : `these ${images.length} documents`} and transcribe what ${images.length === 1 ? 'it says' : 'they say'}.`,
        instructions && `The author is working towards this, which tells you what matters on the page — but transcribe everything regardless, do not filter to it:\n${instructions}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
    // The upload itself, inline, in the same request as the instruction above.
    ...images.map((img) => ({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: 'high' },
    })),
  ]

  const { parsed, usage, model } = await chat(cfg, {
    system: ANALYZE_SYSTEM,
    content,
    maxTokens: 4000,
  })

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
  const readable = parsed.readable !== false && text.length > 0

  return json({
    readable,
    text: readable ? text : '',
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    kind: typeof parsed.kind === 'string' ? parsed.kind.trim() : '',
    reason: readable
      ? ''
      : String(parsed.reason || '').trim() ||
        'No readable text or data could be found in this image.',
    trace: traceOf(images, [], usage, model),
  })
}

/* ---- mode: compose ------------------------------------------- */

const COMPOSE_SYSTEM = `You are the writer behind an investor-grade intelligence publication. You are given material an author uploaded — documents, report pages, screenshots, slides, charts — together with their own instructions, and you write the piece from what that material actually says.

${HOUSE_RULES}

WHAT TO PRODUCE — one argument in three shapes, all from the same material:

· LinkedIn: a hook that states the finding, the specific evidence behind it with
  its figures, what it implies, and one closing line. Short paragraphs separated
  by blank lines. No hashtags unless the author asked for them.
· Email: one idea, one story, one takeaway, one call to action.
· Article: a title, a standfirst, and sections that carry the argument — the
  finding, the evidence, the mechanism, what it means, what to watch.

Return JSON only, in exactly this shape:
{
  "readable": boolean,
  "reason": string,               // when readable is false: what you could and could not see
  "topic": string,                // 2-4 words naming the subject area
  "documentSummary": string,      // one sentence on what the material actually is
  "keyFacts": string[],           // the specific figures/claims you used, each traceable to the material
  "linkedin": { "headline": string, "body": string },
  "email": {
    "subject": string, "preheader": string,
    "idea": string, "story": string, "takeaway": string, "ctaLabel": string
  },
  "article": {
    "title": string, "deck": string, "readMinutes": number,
    "sections": [ { "heading": string, "body": string } ]
  }
}

Set "readable" to false — and leave the channel objects out — when the material
carries no legible content to write from. An author who uploaded an unreadable
scan is better served by being told so than by a generic post.`

/** The brief, as writing directives. Never repeated back in the copy (rule 4). */
function directiveLines(directives) {
  if (!directives || typeof directives !== 'object') return ''
  const lines = Object.entries(directives)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `· ${k}: ${String(v).slice(0, 200)}`)
  return lines.length ? lines.join('\n') : ''
}

async function compose(cfg, payload) {
  const images = usableImages(payload.images, cfg.maxImages)
  const documents = usableDocuments(payload.documents)
  const instructions = String(payload.instructions ?? '').slice(0, 24_000).trim()

  if (!images.length && !documents.length && !instructions) {
    return json({ error: 'Nothing was supplied to write from.' }, 400)
  }

  const parts = []

  parts.push(
    instructions
      ? `THE AUTHOR'S INSTRUCTIONS AND WRITE-UP — this is what they want the piece to say:\n\n${instructions}`
      : 'The author gave no written instructions. Write the piece from the uploaded material alone.',
  )

  const directives = directiveLines(payload.directives)
  if (directives) {
    parts.push(
      `HOW TO WRITE IT (shapes the writing; never appears in the writing):\n${directives}`,
    )
  }

  if (payload.closingPointer) {
    parts.push(
      `CLOSING LINE — end the LinkedIn post and the article on exactly this line, worded naturally, once only:\n${String(payload.closingPointer).slice(0, 400)}`,
    )
  } else {
    parts.push('NO PRODUCT MENTION — this piece carries no promotional line at all.')
  }

  if (documents.length) {
    parts.push(
      `TEXT EXTRACTED FROM THE UPLOADED DOCUMENTS — quote figures from here exactly:\n\n${documents
        .map(
          (d) =>
            `--- ${d.name}${d.pages ? ` (${d.pages} pages)` : ''} ---\n${d.text}`,
        )
        .join('\n\n')}`,
    )
  }

  parts.push(
    images.length
      ? `${images.length} uploaded ${images.length === 1 ? 'image is' : 'images are'} attached below (${images
          .map((i) => i.name)
          .join(', ')}). Read ${images.length === 1 ? 'it' : 'them'} carefully — the numbers, labels and headings in ${images.length === 1 ? 'it' : 'them'} are the source for this piece.`
      : 'No images were uploaded; write from the text above.',
  )

  const content = [
    { type: 'text', text: parts.join('\n\n') },
    // The uploads ride in the same message as the prompt above — one request,
    // instructions and document together.
    ...images.map((img) => ({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: 'high' },
    })),
  ]

  const { parsed, usage, model } = await chat(cfg, {
    system: COMPOSE_SYSTEM,
    content,
    maxTokens: 6000,
  })

  const trace = traceOf(images, documents, usage, model)

  if (parsed.readable === false || !parsed.linkedin) {
    return json({
      readable: false,
      reason:
        String(parsed.reason || '').trim() ||
        'Nothing readable could be found in the uploaded material.',
      trace,
    })
  }

  return json({
    readable: true,
    topic: str(parsed.topic),
    documentSummary: str(parsed.documentSummary),
    keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts.filter(isStr).slice(0, 12) : [],
    linkedin: {
      headline: str(parsed.linkedin?.headline),
      body: str(parsed.linkedin?.body),
    },
    email: {
      subject: str(parsed.email?.subject),
      preheader: str(parsed.email?.preheader),
      idea: str(parsed.email?.idea),
      story: str(parsed.email?.story),
      takeaway: str(parsed.email?.takeaway),
      ctaLabel: str(parsed.email?.ctaLabel),
    },
    article: {
      title: str(parsed.article?.title),
      deck: str(parsed.article?.deck),
      readMinutes: Number(parsed.article?.readMinutes) || 0,
      sections: Array.isArray(parsed.article?.sections)
        ? parsed.article.sections
            .filter((s) => s && isStr(s.body))
            .slice(0, 12)
            .map((s) => ({ heading: str(s.heading), body: str(s.body) }))
        : [],
    },
    trace,
  })
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const str = (v) => (typeof v === 'string' ? v.trim() : '')

/* ---- routes -------------------------------------------------- */

/** Lets the app know whether a real model is wired up before it offers it. */
export function onRequestGet({ env }) {
  const cfg = config(env)
  return json({
    configured: !!cfg.key,
    model: cfg.key ? cfg.model : null,
    maxImages: cfg.maxImages,
    reason: cfg.key ? '' : 'OPENAI_API_KEY is not set on this deployment.',
  })
}

export async function onRequestPost({ request, env }) {
  const cfg = config(env)
  if (!cfg.key) {
    return json(
      {
        error: 'OPENAI_API_KEY is not set on this deployment.',
        unconfigured: true,
      },
      503,
    )
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Malformed request body.' }, 400)
  }

  try {
    if (payload?.mode === 'analyze') return await analyze(cfg, payload)
    if (payload?.mode === 'compose') return await compose(cfg, payload)
    return json({ error: "Unknown mode — expected 'analyze' or 'compose'." }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The model call failed.'
    // Surfaces in `wrangler pages deployment tail`, which is how a deployment
    // is checked when the browser only shows "generation failed".
    console.error('[api/generate]', payload?.mode, message)
    return json({ error: message }, 502)
  }
}
