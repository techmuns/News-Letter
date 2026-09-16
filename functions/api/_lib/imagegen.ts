/* Story-image generation via AWS Bedrock (same Bearer key as text). Tries the
   account's available text-to-image models in order and returns the first PNG
   it gets back as base64. The dashboard overlays the headline/figures itself,
   so we ask the model for a clean cinematic SCENE with no text baked in. */
import { type Env } from './env'
import { ApiError } from './http'

/** Candidate Bedrock image models, best-first. Whichever the account has
    access to wins; the rest fail fast with an access error. */
const IMAGE_MODELS = [
  'amazon.nova-canvas-v2:0',
  'amazon.nova-canvas-v1:0',
  'stability.sd3-5-large-v1:0',
  'stability.stable-image-ultra-v1:1',
  'stability.stable-image-ultra-v1:0',
  'stability.stable-image-core-v1:0',
  'stability.sd3-large-v1:0',
]

/** Ask the Bedrock control plane which image-capable models this account can
    use. Returns their ids (empty if the key can't reach the control plane). */
export async function listImageModels(env: Env): Promise<{ ids: string[]; error?: string }> {
  if (!env.BEDROCK_API_KEY) return { ids: [], error: 'no key' }
  const region = (env.BEDROCK_REGION && env.BEDROCK_REGION.trim()) || 'us-east-1'
  try {
    const res = await fetch(`https://bedrock.${region}.amazonaws.com/foundation-models`, {
      headers: { authorization: `Bearer ${env.BEDROCK_API_KEY}`, accept: 'application/json' },
    })
    if (!res.ok) return { ids: [], error: `${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` }
    const data: any = await res.json()
    const ids = (data?.modelSummaries || [])
      .filter((m: any) => Array.isArray(m?.outputModalities) && m.outputModalities.includes('IMAGE'))
      .map((m: any) => m?.modelId)
      .filter(Boolean)
    return { ids }
  } catch (e: any) {
    return { ids: [], error: String(e?.message || 'failed').slice(0, 200) }
  }
}

function bodyFor(model: string, prompt: string): { body: unknown; width: number; height: number } {
  if (model.startsWith('stability.')) {
    return { body: { prompt: prompt.slice(0, 1800), mode: 'text-to-image', aspect_ratio: '16:9', output_format: 'png' }, width: 1280, height: 720 }
  }
  // amazon nova-canvas / titan share the taskType shape; sizes differ by model.
  const nova = model.startsWith('amazon.nova')
  const width = nova ? 1280 : 1152
  const height = nova ? 720 : 640
  return {
    body: {
      taskType: 'TEXT_IMAGE',
      textToImageParams: { text: prompt.slice(0, 1000) },
      imageGenerationConfig: { numberOfImages: 1, width, height, cfgScale: 7, seed: Math.floor(Math.random() * 858993459) },
    },
    width,
    height,
  }
}

function extractBase64(d: any): string | null {
  if (Array.isArray(d?.images) && typeof d.images[0] === 'string') return d.images[0]
  if (typeof d?.image === 'string') return d.image
  if (Array.isArray(d?.artifacts) && typeof d.artifacts[0]?.base64 === 'string') return d.artifacts[0].base64
  return null
}

async function invokeImageModel(env: Env, model: string, prompt: string): Promise<string | null> {
  if (!env.BEDROCK_API_KEY) throw new ApiError('Image generation needs BEDROCK_API_KEY.', 400)
  const region = (env.BEDROCK_REGION && env.BEDROCK_REGION.trim()) || 'us-east-1'
  const { body } = bodyFor(model, prompt)
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.BEDROCK_API_KEY}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const err: any = new Error(`${res.status}: ${detail.slice(0, 300)}`)
    err.status = res.status
    throw err
  }
  return extractBase64(await res.json())
}

export interface GenImage {
  base64: string
  model: string
  mime: string
}

/** Cloudflare Workers AI — free built-in text-to-image (FLUX). No key needed. */
async function generateWithWorkersAI(env: Env, prompt: string): Promise<GenImage> {
  const model = env.WORKERS_AI_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
  const out: any = await env.AI!.run(model, { prompt: prompt.slice(0, 2000), steps: 6 })
  // FLUX returns { image: "<base64 jpeg>" }; SDXL-style models return raw bytes.
  if (out && typeof out.image === 'string') return { base64: out.image, model, mime: 'image/jpeg' }
  if (out instanceof ArrayBuffer) {
    const bytes = new Uint8Array(out)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return { base64: btoa(bin), model, mime: 'image/png' }
  }
  throw new ApiError('Workers AI returned no image.', 502)
}

/** OpenAI image generation (gpt-image-1 — the DALL·E engine). Returns base64. */
async function generateWithOpenAI(env: Env, prompt: string): Promise<GenImage> {
  const model = env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: prompt.slice(0, 4000), size: '1536x1024', quality: 'high', n: 1 }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ApiError(`OpenAI image error ${res.status}: ${detail.slice(0, 400)}`, 502)
  }
  const data: any = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new ApiError('OpenAI returned no image.', 502)
  return { base64: b64, model, mime: 'image/png' }
}

/** Try each candidate model until one returns an image. Returns raw base64.
    Prefers OpenAI (gpt-image-1) when a key is set — it matches the cinematic
    quality — and falls back to whatever image model Bedrock has enabled. */
export async function generateStoryImage(env: Env, prompt: string): Promise<GenImage> {
  if (env.OPENAI_API_KEY) return generateWithOpenAI(env, prompt)
  if (env.AI) return generateWithWorkersAI(env, prompt)
  let lastErr = ''
  const listed = await listImageModels(env)
  const candidates = listed.ids.length ? Array.from(new Set([...listed.ids, ...IMAGE_MODELS])) : IMAGE_MODELS
  for (const model of candidates) {
    try {
      const b64 = await invokeImageModel(env, model, prompt)
      if (b64) return { base64: b64, model, mime: 'image/png' }
      lastErr = `${model}: empty response`
    } catch (e: any) {
      lastErr = `${model}: ${e?.message || 'failed'}`
      // a 403/AccessDenied means this model isn't enabled — keep trying others
    }
  }
  throw new ApiError(`No image model available. ${lastErr}`, 502)
}

/** Diagnostic: report which candidate model (if any) can generate, without
    returning the full image. Stops at the first success to limit cost. */
export async function probeImageModels(env: Env): Promise<{ working: string | null; available: string[]; listError?: string; tried: { model: string; ok: boolean; error?: string }[] }> {
  const tried: { model: string; ok: boolean; error?: string }[] = []
  // Prefer models the control plane actually reports as image-capable; fall
  // back to the hard-coded candidates when the list is unavailable.
  const listed = await listImageModels(env)
  const candidates = listed.ids.length ? Array.from(new Set([...listed.ids, ...IMAGE_MODELS])) : IMAGE_MODELS
  for (const model of candidates) {
    try {
      const b64 = await invokeImageModel(env, model, 'a simple flat neutral grey studio background, minimalist, no text')
      if (b64) {
        tried.push({ model, ok: true })
        return { working: model, tried }
      }
      tried.push({ model, ok: false, error: 'empty response' })
    } catch (e: any) {
      tried.push({ model, ok: false, error: String(e?.message || 'failed').slice(0, 200) })
    }
  }
  return { working: null, available: listed.ids, listError: listed.error, tried }
}
