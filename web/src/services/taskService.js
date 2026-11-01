import copy from '../lib/copy'
import { validateReview } from '../lib/review'

async function responseJson(response) {
  if (!response.ok) throw new Error(copy.tasks.networkError)
  return response.json()
}
export async function createTask(endpoint, request, signal) {
  const data = await responseJson(await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillId: request.skillId, presentationId: request.presentationId, inputs: request.inputs }), signal }))
  if (typeof data.id !== 'string' || !data.id || data.id.length > 200) throw new Error(copy.tasks.networkError)
  return data.id
}
export async function getTask(endpoint, id, signal) {
  const data = await responseJson(await fetch(`${endpoint.replace(/\/$/, '')}/${encodeURIComponent(id)}`, { signal, cache: 'no-store' }))
  if (!['queued', 'running', 'completed', 'failed', 'cancelled'].includes(data.status) || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 100) throw new Error(copy.tasks.networkError)
  if (data.stageIndex !== undefined && (!Number.isInteger(data.stageIndex) || data.stageIndex < 0 || data.stageIndex > 3)) throw new Error(copy.tasks.networkError)
  if (data.status === 'completed' && data.result) data.result = validateReview(data.result)
  return data
}
export async function cancelTask(endpoint, id) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(copy.tasks.cancelFailed)
}
export function demoTaskResult(workspace) {
  return validateReview(structuredClone(workspace))
}
export async function loadPresentations(endpoint) {
  const data = await responseJson(await fetch(`${endpoint.replace(/\/$/, '')}/presentations`, { cache: 'no-store' }))
  if (!Array.isArray(data.presentations)) throw new Error(copy.tasks.catalogError)
  const ids = new Set()
  for (const item of data.presentations) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.title !== 'string' || !item.title.trim() || typeof item.author !== 'string' || !item.author.trim() || !Number.isInteger(item.slideCount) || item.slideCount < 1) throw new Error(copy.tasks.catalogError)
    ids.add(item.id)
  }
  return data.presentations
}
