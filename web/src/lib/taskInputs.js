import copy from './copy.js'
export function parseTargets(value) {
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) throw new Error(copy.tasks.targetError)
  const items = value.split('\t').map(item => item.trim())
  if (items.some(item => !/^\d+$/.test(item))) throw new Error(copy.tasks.targetError)
  return items
}
export function validateTaskInputs(inputs) {
  return { target: parseTargets(inputs.target).join('\t') }
}
