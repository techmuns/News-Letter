/* AI generation provider.

   Primary: AWS Bedrock via a Bearer API key against the native runtime
   invoke endpoint —
     POST https://bedrock-runtime.<region>.amazonaws.com/model/<model-id>/invoke
     Authorization: Bearer <BEDROCK_API_KEY>
   The body is the Anthropic Messages shape with `anthropic_version` set and
   NO `model` field (the model id lives in the URL). The response body is the
   same Anthropic message shape the direct API returns.

   Fallback: the direct Anthropic API (x-api-key) when no BEDROCK_API_KEY.

   Structured JSON is requested via the prompt (schema embedded) and parsed
   defensively, so it works on the native Bedrock invoke path, which does not
   accept the Anthropic API's `output_config` structured-output parameter. */
import { type Env, DEFAULT_BEDROCK_MODEL } from './env'
import { ApiError } from './http'

export type AiProvider = 'bedrock' | 'anthropic' | 'none'

export function aiProvider(env: Env): AiProvider {
  if (env.BEDROCK_API_KEY) return 'bedrock'
  if (env.ANTHROPIC_API_KEY) return 'anthropic'
  return 'none'
}

export function aiConfigured(env: Env): boolean {
  return aiProvider(env) !== 'none'
}

/** The model id reported in /api/health and used for generation. */
export function aiModel(env: Env): string {
  if (env.BEDROCK_API_KEY) return env.BEDROCK_MODEL_ID || env.GEN_MODEL || DEFAULT_BEDROCK_MODEL
  return env.GEN_MODEL || 'claude-opus-5'
}

/** A base64 image to attach to the user turn (vision). `data` is raw base64
    with no `data:` prefix; `mediaType` is e.g. "image/png" / "image/jpeg". */
export interface ImageInput {
  mediaType: string
  data: string
}

interface CallInput {
  system: string
  user: string
  images?: ImageInput[]
  maxTokens?: number
}

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/** Validate/normalize untrusted image input from a request body: cap the count,
    coerce the media type to an allowed value, strip any `data:` prefix, and drop
    anything oversized. */
export function sanitizeImages(raw: unknown): ImageInput[] {
  if (!Array.isArray(raw)) return []
  const out: ImageInput[] = []
  for (const it of raw.slice(0, 6)) {
    const rawData = typeof (it as any)?.data === 'string' ? (it as any).data : ''
    let mt = typeof (it as any)?.mediaType === 'string' ? (it as any).mediaType.toLowerCase() : ''
    if (!ALLOWED_IMAGE_TYPES.has(mt)) mt = 'image/png'
    const data = rawData.replace(/^data:[^;]+;base64,/, '')
    if (data && data.length < 8_000_000) out.push({ mediaType: mt, data })
  }
  return out
}

/** Build the user-turn content. Plain string when there are no images; an
    Anthropic content-block array (text + image blocks) when there are — the
    same shape works on both the Bedrock invoke path and the direct API. */
function buildUserContent(user: string, images?: ImageInput[]): unknown {
  if (!images || images.length === 0) return user
  const blocks: any[] = []
  if (user && user.trim()) blocks.push({ type: 'text', text: user })
  for (const im of images.slice(0, 6)) {
    if (!im?.data) continue
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: im.mediaType || 'image/png', data: im.data },
    })
  }
  return blocks.length ? blocks : user
}

/** Pull the assistant text out of an Anthropic-shaped message response. */
function messageText(data: any): string {
  if (data?.stop_reason === 'refusal') {
    throw new ApiError('The model declined this request. Try different inputs.', 422)
  }
  return (data?.content || [])
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim()
}

/** One completion. Routes to Bedrock (Bearer) or the direct Anthropic API. */
async function callClaudeText(env: Env, input: CallInput): Promise<string> {
  const maxTokens = input.maxTokens ?? 8000

  if (env.BEDROCK_API_KEY) {
    const region = (env.BEDROCK_REGION && env.BEDROCK_REGION.trim()) || 'us-east-1'
    const model = env.BEDROCK_MODEL_ID || env.GEN_MODEL || DEFAULT_BEDROCK_MODEL
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.BEDROCK_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: buildUserContent(input.user, input.images) }],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ApiError(`Bedrock error ${res.status}: ${detail.slice(0, 400)}`, 502)
    }
    return messageText(await res.json())
  }

  if (env.ANTHROPIC_API_KEY) {
    const model = env.GEN_MODEL || 'claude-opus-5'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: buildUserContent(input.user, input.images) }],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ApiError(`Claude API error ${res.status}: ${detail.slice(0, 400)}`, 502)
    }
    return messageText(await res.json())
  }

  throw new ApiError('No AI provider configured — set BEDROCK_API_KEY (see SETUP.md).', 400)
}

/** Strip code fences, then isolate the FIRST complete, balanced JSON object.
    Scans while tracking string/escape state, so it tolerates trailing prose and
    braces that appear inside string values (naive first-{/last-} slicing does
    not). Falls back to a first-{/last-} slice if no balanced object is found
    (e.g. a truncated reply). */
function extractJson(text: string): string {
  let t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) t = fenced[1].trim()
  const start = t.indexOf('{')
  if (start < 0) return t
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < t.length; i++) {
    const ch = t[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return t.slice(start, i + 1)
    }
  }
  const end = t.lastIndexOf('}')
  return end > start ? t.slice(start, end + 1) : t.slice(start)
}

/** Parse the model's reply into an object, trying a couple of safe repairs
    (balanced-object extraction, then trailing-comma removal). Returns null if
    nothing parses. */
function parseJsonLoose<T>(text: string): T | null {
  const raw = extractJson(text)
  const candidates = [raw, raw.replace(/,\s*([}\]])/g, '$1')]
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T
    } catch {
      /* try the next candidate */
    }
  }
  return null
}

/** Generate a JSON object of shape `schema`. Schema is embedded in the prompt
    (portable across Bedrock invoke + the Anthropic API) and the reply is parsed
    defensively. Retries once with a corrective nudge if the first reply doesn't
    parse — model JSON is stochastic (an unescaped quote/newline in a string is
    the usual culprit), and a second attempt almost always succeeds. */
export async function callClaudeJson<T = any>(
  env: Env,
  input: { system: string; user: string; schema: unknown; images?: ImageInput[]; maxTokens?: number },
): Promise<T> {
  const system = `${input.system}

# Output format
Return ONLY a single JSON object — no prose, no explanation, and no markdown code fences. The JSON must be strictly valid: escape every double quote (\\") and newline (\\n) that appears INSIDE a string value. The object MUST conform to this JSON Schema:
${JSON.stringify(input.schema)}`

  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? input.user
        : `${input.user}

# Correction
Your previous reply could not be parsed as JSON. Return ONLY the single JSON object again — strictly valid this time. Escape any double quotes and newlines inside string values, and include no text outside the object.`
    const text = await callClaudeText(env, {
      system,
      user,
      images: input.images,
      maxTokens: input.maxTokens,
    })
    const parsed = parseJsonLoose<T>(text)
    if (parsed) return parsed
  }
  throw new ApiError('The model did not return valid JSON. Try again.', 502)
}
