/* /api/harvest — GET reports whether Firecrawl is connected;
   POST reads the selected finance voices and returns their latest real posts. */

import { handleHarvest, handleStatus } from '../../server/firecrawl'
import { errorJson, json, readJsonBody, type PagesContext } from '../../server/http'
import type { HarvestRequest } from '../../shared/harvest'

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  return json(handleStatus(env))
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  try {
    const body = await readJsonBody<HarvestRequest>(request)
    return json(await handleHarvest(env, body))
  } catch (err) {
    return errorJson(err)
  }
}
