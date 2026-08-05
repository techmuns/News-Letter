// Cloudflare Pages Function — the one place a model is called.
//
// Two things happen here, both against a vision-capable model — OpenAI by
// default, with AWS Bedrock (Anthropic's Claude) as an automatic failover when
// its credentials are set — and both in a single request each:
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
// No credential reaches the browser: the client posts to this route on our own
// origin and this route holds the OpenAI key and the AWS Bedrock credentials.
// With neither configured the route says so and the app falls back to its
// deterministic composer.

// gpt-4o-mini is the default because it reads images, costs little, and — the
// part that matters here — is available to almost every project, including the
// new or restricted ones that don't have gpt-4o switched on yet. Any deployment
// can still point OPENAI_MODEL at a different model its key can use.
const DEFAULT_MODEL = 'gpt-4o-mini'
// If a chosen model is refused because the key's project can't reach it, the
// call retries once on this one instead of failing the whole draft.
const FALLBACK_MODEL = 'gpt-4o-mini'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

// AWS Bedrock is the failover — or, with AI_PROVIDER=bedrock, the primary. The
// model is Anthropic's Claude on Bedrock, which reads images too, so the same
// analyze/compose calls work through it unchanged. Any deployment can point
// BEDROCK_MODEL at whatever its account has enabled (including a us./eu. cross-
// region inference-profile id).
const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
const DEFAULT_BEDROCK_REGION = 'us-east-1'
const BEDROCK_ANTHROPIC_VERSION = 'bedrock-2023-05-31'

/* ---- what this costs ----------------------------------------
   Every call here is billed per token, and images are the
   expensive part: at detail "high" the model tiles the picture
   and charges per tile, while "low" is a flat, much smaller
   charge. The defaults below are set for a demo — few images,
   little document text, short answers — and every one of them
   is an environment variable, so a production deployment can
   turn the quality back up without touching this file.

   None of it is a spending guarantee. The only hard cap lives
   in the OpenAI dashboard (Settings → Limits); set one.
   ------------------------------------------------------------ */

/** Images per request. Each one is billed, so the cap is deliberate. */
const DEFAULT_MAX_IMAGES = 3
/** Extracted document text carried into the prompt, per request. */
const DEFAULT_MAX_DOC_CHARS = 12_000
/** How the model is told to look at an image: 'auto' | 'low' | 'high'. */
const DEFAULT_IMAGE_DETAIL = 'auto'
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

// Trim whitespace and any wrapping quotes off a pasted secret. A key saved with
// a trailing newline or surrounding quotes is the most common reason a valid
// credential still comes back 401/403 — this stops that whole class of failure.
function clean(v) {
  return (v || '').trim().replace(/^["']+|["']+$/g, '')
}

/**
 * AWS Bedrock config, or undefined when no credentials are set.
 *
 * Accepts the BEDROCK_* names first and the conventional AWS_* names as a
 * fallback, so a deployment that already carries AWS keys works without
 * renaming anything. Only the access key id and secret are required; the region
 * and model have sensible defaults and a session token is optional.
 */
function bedrockConfig(env) {
  const accessKeyId = clean(env.BEDROCK_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID)
  const secretAccessKey = clean(env.BEDROCK_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY)
  if (!accessKeyId || !secretAccessKey) return undefined
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: clean(env.BEDROCK_SESSION_TOKEN || env.AWS_SESSION_TOKEN) || undefined,
    region:
      clean(env.BEDROCK_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION) ||
      DEFAULT_BEDROCK_REGION,
    model: clean(env.BEDROCK_MODEL) || DEFAULT_BEDROCK_MODEL,
  }
}

function config(env) {
  const detail = String(env.OPENAI_IMAGE_DETAIL || DEFAULT_IMAGE_DETAIL).toLowerCase()
  return {
    key: clean(env.OPENAI_API_KEY) || undefined,
    // 'openai' (default) calls OpenAI first and only falls over to Bedrock on a
    // failure; 'bedrock' skips OpenAI entirely — the right setting when the
    // OpenAI key is out of quota.
    provider: String(env.AI_PROVIDER || 'openai').toLowerCase() === 'bedrock' ? 'bedrock' : 'openai',
    bedrock: bedrockConfig(env),
    model: env.OPENAI_MODEL || DEFAULT_MODEL,
    baseUrl: (env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    maxImages: Math.max(1, Number(env.OPENAI_MAX_IMAGES) || DEFAULT_MAX_IMAGES),
    maxDocChars: Math.max(500, Number(env.OPENAI_MAX_DOC_CHARS) || DEFAULT_MAX_DOC_CHARS),
    // A ceiling, not a budget: you are billed for what is generated, not for
    // this number. It is set high enough that a dense page transcription is
    // never cut off mid-JSON, which would fail the call and cost the input
    // tokens anyway — a truncated answer is the expensive outcome, not a saving.
    maxOutputTokens: Math.max(500, Number(env.OPENAI_MAX_OUTPUT_TOKENS) || 3000),
    imageDetail: ['auto', 'low', 'high'].includes(detail) ? detail : DEFAULT_IMAGE_DETAIL,
    // Reading an upload the moment it lands makes the write-up show what the
    // document says — and costs a call per file. Turn it off and the picture is
    // read once, at generation time, halving the calls for the same demo.
    readOnUpload: String(env.OPENAI_READ_ON_UPLOAD ?? 'true').toLowerCase() !== 'false',
    org: env.OPENAI_ORG || '',
    project: env.OPENAI_PROJECT || '',
  }
}

/** An image part, at whatever detail this deployment is paying for. */
function imagePart(cfg, img) {
  return { type: 'image_url', image_url: { url: img.dataUrl, detail: cfg.imageDetail } }
}

/* ---- the model call ------------------------------------------ */

/**
 * The model call, with failover — the one entry point analyze/compose use.
 *
 * OpenAI is the default primary and AWS Bedrock is the failover: any OpenAI
 * failure (a 429 rate limit or exhausted quota, a 5xx, a dead key, a network
 * drop) retries the same request on Bedrock when Bedrock credentials are set.
 * With AI_PROVIDER=bedrock, Bedrock is called directly and OpenAI is skipped.
 * Both providers read images, so the caller never has to care which answered.
 */
async function chat(cfg, request) {
  if (cfg.provider === 'bedrock') {
    if (!cfg.bedrock) throw new Error('AI_PROVIDER=bedrock, but no Bedrock credentials are set.')
    return callBedrock(cfg, request)
  }
  if (cfg.key) {
    try {
      return await callOpenAI(cfg, request)
    } catch (err) {
      if (cfg.bedrock) {
        // The whole point of the failover: an OpenAI outage becomes a Bedrock
        // call instead of a dead draft. Logged so the edge tail shows the switch.
        console.error('[api/generate] OpenAI failed, failing over to Bedrock:', err?.message)
        return await callBedrock(cfg, request)
      }
      throw err
    }
  }
  // No OpenAI key, but Bedrock is configured — use it as the sole provider.
  if (cfg.bedrock) return callBedrock(cfg, request)
  throw new Error('No model provider is configured.')
}

/**
 * One OpenAI chat completion, JSON back.
 *
 * `temperature` and `max_tokens` are rejected by some newer models, so a 400
 * naming one of them is retried once without it rather than surfacing as
 * "generation failed" to the author.
 */
async function callOpenAI(cfg, { system, content, maxTokens }) {
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

  for (let attempt = 0; attempt < 4; attempt++) {
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
      const choice = data?.choices?.[0]
      const text = choice?.message?.content ?? ''
      // A JSON answer cut off at the token ceiling is unparseable, and "did not
      // return usable JSON" would send someone hunting the wrong bug.
      if (choice?.finish_reason === 'length') {
        throw new Error(
          'The answer hit the output token limit — raise OPENAI_MAX_OUTPUT_TOKENS.',
        )
      }
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
    // The key's project can't use this model (e.g. a project without gpt-4o
    // enabled). Retry once on the fallback, which nearly every project can
    // reach; when we're already on it, fall through and surface the real error.
    if (
      (res.status === 403 || res.status === 404) &&
      /access to model|not have access|does not exist|model_not_found/i.test(detail) &&
      body.model !== FALLBACK_MODEL
    ) {
      body.model = FALLBACK_MODEL
      continue
    }
    throw Object.assign(new Error(openAiMessage(res.status, detail)), { status: res.status })
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

/* ---- AWS Bedrock (SigV4-signed, no SDK) ----------------------

   Cloudflare Workers can't run the AWS SDK, so the request is signed by hand
   with the Web Crypto API already in the runtime. The signing is the one part
   of this file that is wrong-until-proven-right, so signRequest is exported and
   checked against AWS's published SigV4 test vector (see the test alongside).
   ------------------------------------------------------------ */

const AWS_ENC = new TextEncoder()

function toHex(buf) {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? AWS_ENC.encode(input) : input
  return toHex(await crypto.subtle.digest('SHA-256', bytes))
}

async function hmacRaw(key, msg) {
  const keyBytes = typeof key === 'string' ? AWS_ENC.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, AWS_ENC.encode(msg))
}

/**
 * The AWS SigV4 Authorization header for one request.
 *
 * `headers` is the list of [lowercase-name, value] pairs to sign, already in
 * the order they should be canonicalised (sorted by name). Exported so the
 * signing math can be pinned to AWS's own test vectors rather than trusted.
 */
export async function signRequest({
  method,
  canonicalUri,
  canonicalQuery = '',
  headers,
  payloadHash,
  accessKeyId,
  secretAccessKey,
  region,
  service,
  amzDate,
  dateStamp,
}) {
  const canonicalHeaders = headers.map(([n, v]) => `${n}:${v}\n`).join('')
  const signedHeaders = headers.map(([n]) => n).join(';')
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = await hmacRaw(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmacRaw(kDate, region)
  const kService = await hmacRaw(kRegion, service)
  const kSigning = await hmacRaw(kService, 'aws4_request')
  const signature = toHex(await hmacRaw(kSigning, stringToSign))

  return {
    signedHeaders,
    signature,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

/** ISO time → the two AWS date forms: 20060102T150405Z and 20060102. */
function awsDateStamps(date) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

/** OpenAI chat parts → Anthropic Messages content (text blocks + base64 images). */
export function toAnthropicMessages(content) {
  const parts = []
  for (const p of content) {
    if (p.type === 'text') {
      parts.push({ type: 'text', text: p.text })
    } else if (p.type === 'image_url') {
      const url = (p.image_url && p.image_url.url) || ''
      const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(url)
      if (!m) continue
      let mediaType = m[1].toLowerCase()
      // Anthropic names it image/jpeg; a data URL may say image/jpg.
      if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
      parts.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: m[2] } })
    }
  }
  return [{ role: 'user', content: parts }]
}

/**
 * Claude is told to return JSON only; this rescues the occasional reply that
 * arrives fenced in ```json or with a stray sentence around the object.
 */
export function parseJsonLoose(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  const attempts = [trimmed, trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')]
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) attempts.push(trimmed.slice(start, end + 1))
  for (const a of attempts) {
    try {
      return JSON.parse(a)
    } catch {
      /* try the next shape */
    }
  }
  return null
}

/** One Bedrock InvokeModel call, JSON back — same return shape as callOpenAI. */
async function callBedrock(cfg, { system, content, maxTokens }) {
  const b = cfg.bedrock
  const host = `bedrock-runtime.${b.region}.amazonaws.com`
  const canonicalUri = `/model/${encodeURIComponent(b.model)}/invoke`
  const body = JSON.stringify({
    anthropic_version: BEDROCK_ANTHROPIC_VERSION,
    max_tokens: maxTokens,
    temperature: 0.4,
    system,
    messages: toAnthropicMessages(content),
  })

  const { amzDate, dateStamp } = awsDateStamps(new Date())
  const payloadHash = await sha256Hex(body)
  // Sorted by header name: content-type < host < x-amz-date < x-amz-security-token.
  const signedPairs = [
    ['content-type', 'application/json'],
    ['host', host],
    ['x-amz-date', amzDate],
    ...(b.sessionToken ? [['x-amz-security-token', b.sessionToken]] : []),
  ]
  const { authorization } = await signRequest({
    method: 'POST',
    canonicalUri,
    headers: signedPairs,
    payloadHash,
    accessKeyId: b.accessKeyId,
    secretAccessKey: b.secretAccessKey,
    region: b.region,
    service: 'bedrock',
    amzDate,
    dateStamp,
  })

  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: authorization,
      ...(b.sessionToken ? { 'X-Amz-Security-Token': b.sessionToken } : {}),
    },
    body,
  })

  if (!res.ok) {
    const detail = await res.text()
    throw Object.assign(new Error(bedrockMessage(res.status, detail, b.model)), {
      status: res.status,
    })
  }

  const data = await res.json()
  if (data?.stop_reason === 'max_tokens') {
    throw new Error('The answer hit the output token limit — raise OPENAI_MAX_OUTPUT_TOKENS.')
  }
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((x) => x && x.type === 'text')
        .map((x) => x.text)
        .join('')
    : ''
  const parsed = parseJsonLoose(text)
  if (!parsed) throw new Error('The model did not return usable JSON.')
  return {
    parsed,
    // Normalised to the OpenAI usage shape so the trace card reads the same.
    usage: data?.usage
      ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens }
      : null,
    model: data?.model || b.model,
  }
}

/** Turns a Bedrock error body into a line the author can act on. */
function bedrockMessage(status, detail, model) {
  let message = ''
  try {
    const parsed = JSON.parse(detail)
    message = parsed?.message || parsed?.Message || ''
  } catch {
    message = ''
  }
  if (status === 403) {
    return `AWS Bedrock denied the request (403) — check the credentials and that the IAM policy allows bedrock:InvokeModel.${message ? ` ${message}` : ''}`
  }
  if (status === 404) {
    return `AWS Bedrock has no model "${model}" in this region — set BEDROCK_MODEL / BEDROCK_REGION to one your account has enabled.`
  }
  if (/inference profile|on-demand|not authoriz|access to the model|isn't authorized/i.test(message)) {
    return `AWS Bedrock can't use "${model}" on-demand — enable model access in the Bedrock console, or set BEDROCK_MODEL to an inference-profile id (e.g. us.anthropic.claude-3-5-sonnet-20241022-v2:0). ${message}`
  }
  if (status === 429) return 'AWS Bedrock is throttling (429) — try again shortly.'
  return message || `AWS Bedrock returned ${status}.`
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

function usableDocuments(raw, maxChars) {
  if (!Array.isArray(raw)) return []
  let budget = maxChars
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
function traceOf(cfg, images, documents, usage, model) {
  return {
    model,
    imageDetail: cfg.imageDetail,
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
    ...images.map((img) => imagePart(cfg, img)),
  ]

  const { parsed, usage, model } = await chat(cfg, {
    system: ANALYZE_SYSTEM,
    content,
    // A transcription runs long; cutting it short breaks the JSON, so this
    // ceiling sits above what a page needs rather than at the budget.
    maxTokens: cfg.maxOutputTokens,
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
    trace: traceOf(cfg, images, [], usage, model),
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
  const documents = usableDocuments(payload.documents, cfg.maxDocChars)
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
    ...images.map((img) => imagePart(cfg, img)),
  ]

  const { parsed, usage, model } = await chat(cfg, {
    system: COMPOSE_SYSTEM,
    content,
    maxTokens: cfg.maxOutputTokens,
  })

  const trace = traceOf(cfg, images, documents, usage, model)

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
  const usingBedrock = cfg.provider === 'bedrock' && !!cfg.bedrock
  const configured = !!cfg.key || !!cfg.bedrock
  // The model the next call will actually use: Bedrock's when it is primary or
  // the only provider, OpenAI's otherwise.
  const activeModel = usingBedrock
    ? cfg.bedrock.model
    : cfg.key
      ? cfg.model
      : cfg.bedrock
        ? cfg.bedrock.model
        : null
  return json({
    configured,
    model: activeModel,
    provider: usingBedrock ? 'bedrock' : cfg.key ? 'openai' : cfg.bedrock ? 'bedrock' : null,
    // OpenAI is primary and Bedrock is standing by to catch a failure.
    bedrockFailover: !!cfg.key && !!cfg.bedrock && cfg.provider !== 'bedrock',
    maxImages: cfg.maxImages,
    imageDetail: cfg.imageDetail,
    // The browser needs this one: it decides whether an upload is read on the
    // spot or left for generation time, which is the difference between two
    // billed calls and one.
    readOnUpload: cfg.readOnUpload,
    reason: configured
      ? ''
      : 'No model is configured: set OPENAI_API_KEY, or Bedrock credentials (BEDROCK_ACCESS_KEY_ID / BEDROCK_SECRET_ACCESS_KEY).',
  })
}

export async function onRequestPost({ request, env }) {
  const cfg = config(env)
  if (!cfg.key && !cfg.bedrock) {
    return json(
      {
        error:
          'No model is configured: set OPENAI_API_KEY, or Bedrock credentials (BEDROCK_ACCESS_KEY_ID / BEDROCK_SECRET_ACCESS_KEY).',
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
