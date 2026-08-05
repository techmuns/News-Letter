/* LinkedIn publishing via Buffer's current GraphQL API.

   Why Buffer: it already holds an approved LinkedIn integration, so we can post
   to the Munshot *company page* without going through LinkedIn's own
   Community-Management-API approval (which takes days/weeks). You connect the
   page to Buffer once, generate a token, and we push posts to it.

   API facts (verified against developers.buffer.com):
   - Endpoint: POST https://api.buffer.com  (GraphQL)
   - Auth:     Authorization: Bearer <token>   (token from publish.buffer.com/settings/api)
   - Images:   must be a PUBLIC URL — Buffer does not accept direct uploads.
   - Free tier is enough for a daily post.  */
import type { Env } from './env'
import { ApiError } from './http'

const BUFFER_API = 'https://api.buffer.com'

async function bufferGraphQL(token: string, query: string): Promise<any> {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = data?.errors?.map((e: any) => e.message).join('; ') || `HTTP ${res.status}`
    throw new ApiError(`Buffer API error: ${msg}`, res.status === 401 ? 401 : 502)
  }
  if (data?.errors?.length) {
    throw new ApiError(`Buffer: ${data.errors.map((e: any) => e.message).join('; ')}`, 502)
  }
  return data?.data
}

export interface PublishInput {
  text: string
  /** public image URL (optional) — Buffer requires a publicly reachable URL */
  imageUrl?: string
  /** ISO-8601 UTC timestamp for a scheduled post; omit to add to the Buffer queue */
  scheduledAt?: string
}

export async function publishToBuffer(env: Env, input: PublishInput) {
  if (!env.BUFFER_ACCESS_TOKEN) throw new ApiError('BUFFER_ACCESS_TOKEN is not set (see SETUP.md).', 400)
  if (!env.BUFFER_LINKEDIN_CHANNEL_ID) {
    throw new ApiError('BUFFER_LINKEDIN_CHANNEL_ID is not set (see SETUP.md).', 400)
  }
  if (!input.text || !input.text.trim()) throw new ApiError('Post text is required.', 400)

  const scheduled = Boolean(input.scheduledAt)
  // JSON.stringify produces a valid GraphQL string literal for arbitrary text
  // (handles quotes, newlines, unicode) — matches the docs' inline-input example.
  const fields = [
    `text: ${JSON.stringify(input.text)}`,
    `channelId: ${JSON.stringify(env.BUFFER_LINKEDIN_CHANNEL_ID)}`,
    `schedulingType: automatic`,
    `mode: ${scheduled ? 'customScheduled' : 'addToQueue'}`,
  ]
  if (scheduled) fields.push(`dueAt: ${JSON.stringify(input.scheduledAt)}`)
  if (input.imageUrl && input.imageUrl.trim()) {
    fields.push(`assets: [{ image: { url: ${JSON.stringify(input.imageUrl.trim())} } }]`)
  }

  const mutation = `mutation {
    createPost(input: { ${fields.join(', ')} }) {
      ... on PostActionSuccess { post { id status dueAt } }
      ... on MutationError { message }
    }
  }`

  const data = await bufferGraphQL(env.BUFFER_ACCESS_TOKEN, mutation)
  const result = data?.createPost
  if (result?.message) throw new ApiError(`Buffer rejected the post: ${result.message}`, 400)
  const post = result?.post
  return {
    postId: post?.id ?? null,
    status: post?.status ?? 'queued',
    dueAt: post?.dueAt ?? null,
    scheduled,
  }
}

/** Convenience: list connected channels so you can find the LinkedIn channel id.
    Needs BUFFER_ORG_ID; otherwise returns a hint pointing to the Buffer Explorer. */
export async function listBufferChannels(env: Env) {
  if (!env.BUFFER_ACCESS_TOKEN) throw new ApiError('BUFFER_ACCESS_TOKEN is not set.', 400)
  if (!env.BUFFER_ORG_ID) {
    return {
      channels: [],
      hint:
        'Set BUFFER_ORG_ID to auto-list channels, or open the Buffer GraphQL Explorer ' +
        '(developers.buffer.com/explorer), run `{ channels(input:{organizationId:"..."}){ id name service } }`, ' +
        'and paste the LinkedIn channel id into BUFFER_LINKEDIN_CHANNEL_ID.',
    }
  }
  const query = `query { channels(input: { organizationId: ${JSON.stringify(
    env.BUFFER_ORG_ID,
  )} }) { id name service } }`
  const data = await bufferGraphQL(env.BUFFER_ACCESS_TOKEN, query)
  return { channels: data?.channels ?? [] }
}
