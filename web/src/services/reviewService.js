import { demoReview, validateReview } from '../lib/review'
import copy from '../lib/copy'

export async function loadWorkspace() {
  const response = await fetch('/app-config.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(copy.errors.config)
  const config = await response.json()
  const endpoint = config.reviewEndpoint
  const taskEndpoint = config.taskEndpoint ?? null
  if (taskEndpoint !== null && (typeof taskEndpoint !== 'string' || !taskEndpoint.startsWith('/') || taskEndpoint.startsWith('//'))) throw new Error(copy.errors.config)
  if (endpoint !== null && (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//'))) throw new Error(copy.errors.config)
  if (!endpoint) return { data: demoReview(), endpoint: null, taskEndpoint }
  const result = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!result.ok) throw new Error(copy.errors.loadFailed)
  return { data: validateReview(await result.json()), endpoint, taskEndpoint }
}

export async function saveWorkspace(endpoint, data) {
  if (!endpoint) throw new Error(copy.errors.serverUnavailable)
  try {
    const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
    if (!response.ok) throw new Error()
  } catch { throw new Error(copy.errors.saveFailed) }
}
