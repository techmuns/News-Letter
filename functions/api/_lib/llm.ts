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

interface CallInput {
  system: string
  user: string
  maxTokens?: number
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
        messages: [{ role: 'user', content: input.user }],
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
        messages: [{ role: 'user', content: input.user }],
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

/** Strip code fences / prose and isolate the outermost JSON object. */
function extractJson(text: string): string {
  let t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) t = fenced[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return t
}

/** Generate a JSON object of shape `schema`. Schema is embedded in the prompt
    (portable across Bedrock invoke + the Anthropic API) and the reply is parsed
    defensively. */
export async function callClaudeJson<T = any>(
  env: Env,
  input: { system: string; user: string; schema: unknown; maxTokens?: number },
): Promise<T> {
  const system = `${input.system}

# Output format
Return ONLY a single JSON object — no prose, no explanation, and no markdown code fences. The object MUST conform to this JSON Schema:
${JSON.stringify(input.schema)}`

  const text = await callClaudeText(env, {
    system,
    user: input.user,
    maxTokens: input.maxTokens,
  })

  try {
    return JSON.parse(extractJson(text)) as T
  } catch {
    throw new ApiError('The model did not return valid JSON. Try again.', 502)
  }
}
