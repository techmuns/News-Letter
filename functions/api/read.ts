/* /api/read — deep-reads one harvested post as markdown, on demand.
   Restricted to URLs belonging to a voice on the roster so this can't be
   used as an open proxy for arbitrary pages. */

import { handleRead, isRosterUrl } from '../../server/firecrawl'
import { errorJson, json, readJsonBody, type PagesContext } from '../../server/http'
import type { ReadRequest } from '../../shared/harvest'

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  try {
    const { url } = await readJsonBody<ReadRequest>(request)
    if (!url || !isRosterUrl(url)) {
      return json({ error: 'URL is not on the finance-voices roster' }, 400)
    }
    return json(await handleRead(env, url))
  } catch (err) {
    return errorJson(err)
  }
}
