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
    if (res.status === 401) {
      throw new ApiError(
        'Buffer token is invalid or expired — regenerate it at publish.buffer.com/settings/api.',
        401,
      )
    }
    const msg = data?.errors?.map((e: any) => e.message).join('; ') || `HTTP ${res.status}`
    throw new ApiError(`Buffer API error: ${msg}`, 502)
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

export interface CreatePostInput extends PublishInput {
  channelId: string
}

/** Publishes through Buffer's createPost mutation for a specific channel and
    bearer token — the token can be the app-wide BUFFER_ACCESS_TOKEN or a
    per-user OAuth access token; this function doesn't care which. */
export async function createBufferPost(token: string, input: CreatePostInput) {
  if (!input.text || !input.text.trim()) throw new ApiError('Post text is required.', 400)
  if (!input.channelId) throw new ApiError('channelId is required.', 400)

  const scheduled = Boolean(input.scheduledAt)
  // JSON.stringify produces a valid GraphQL string literal for arbitrary text
  // (handles quotes, newlines, unicode) — matches the docs' inline-input example.
  const fields = [
    `text: ${JSON.stringify(input.text)}`,
    `channelId: ${JSON.stringify(input.channelId)}`,
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

  const data = await bufferGraphQL(token, mutation)
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

/** The app-wide static-token publish path (BUFFER_ACCESS_TOKEN +
    BUFFER_LINKEDIN_CHANNEL_ID) — kept alongside the per-user OAuth path as a
    manual fallback/escape hatch. */
export async function publishToBuffer(env: Env, input: PublishInput) {
  if (!env.BUFFER_ACCESS_TOKEN) throw new ApiError('BUFFER_ACCESS_TOKEN is not set (see SETUP.md).', 400)
  if (!env.BUFFER_LINKEDIN_CHANNEL_ID) {
    throw new ApiError('BUFFER_LINKEDIN_CHANNEL_ID is not set (see SETUP.md).', 400)
  }
  return createBufferPost(env.BUFFER_ACCESS_TOKEN, { ...input, channelId: env.BUFFER_LINKEDIN_CHANNEL_ID })
}

export interface BufferOrganization {
  id: string
  name: string
  ownerEmail?: string
}

export interface BufferChannel {
  id: string
  name?: string
  displayName?: string
  service: string
  /** true when `service` names LinkedIn — the field the UI filters on to
      show only channels this feature can publish to. */
  isLinkedIn: boolean
}

/** Organizations the token's Buffer account has access to. */
export async function fetchBufferOrganizations(token: string): Promise<BufferOrganization[]> {
  const data = await bufferGraphQL(token, `query { account { organizations { id name ownerEmail } } }`)
  return Array.isArray(data?.account?.organizations) ? data.account.organizations : []
}

/** Channels in one organization, each flagged with whether it's a LinkedIn channel. */
export async function fetchBufferChannels(token: string, organizationId: string): Promise<BufferChannel[]> {
  if (!organizationId) throw new ApiError('organizationId is required.', 400)
  const data = await bufferGraphQL(
    token,
    `query { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) { id name displayName service } }`,
  )
  const channels = Array.isArray(data?.channels) ? data.channels : []
  return channels.map((c: any) => ({
    ...c,
    isLinkedIn: String(c?.service || '').toLowerCase().includes('linkedin'),
  }))
}

/** List connected channels so you can find the LinkedIn channel id. Only the
    token is needed — the organization is auto-discovered (BUFFER_ORG_ID is used
    if set, or as a fallback). Flags the LinkedIn channel(s) so it's obvious which
    id to paste into BUFFER_LINKEDIN_CHANNEL_ID. */
export async function listBufferChannels(env: Env) {
  if (!env.BUFFER_ACCESS_TOKEN) throw new ApiError('BUFFER_ACCESS_TOKEN is not set.', 400)

  let orgId = env.BUFFER_ORG_ID
  if (!orgId) {
    // Best-effort: discover the account's organization from the token itself.
    try {
      const acct = await bufferGraphQL(
        env.BUFFER_ACCESS_TOKEN,
        `query { account { currentOrganization { id } organizations { id name } } }`,
      )
      orgId =
        acct?.account?.currentOrganization?.id || acct?.account?.organizations?.[0]?.id || undefined
    } catch {
      /* fall through to the explorer hint below */
    }
  }
  if (!orgId) {
    return {
      channels: [],
      hint:
        'Could not auto-detect your Buffer organization. Set BUFFER_ORG_ID, or open the Buffer ' +
        'GraphQL Explorer (developers.buffer.com/explorer), run ' +
        '`{ channels(input:{organizationId:"..."}){ id name service } }`, and paste the LinkedIn ' +
        'channel id into BUFFER_LINKEDIN_CHANNEL_ID.',
    }
  }

  const channels = await fetchBufferChannels(env.BUFFER_ACCESS_TOKEN, orgId)
  const linkedin = channels.filter((c) => c.isLinkedIn)
  return {
    organizationId: orgId,
    channels,
    linkedin,
    // The id to paste into BUFFER_LINKEDIN_CHANNEL_ID (first LinkedIn channel).
    linkedinChannelId: linkedin[0]?.id ?? null,
  }
}
