import copy from './copy.js'
import demoPayload from '../data/demo-review.json' with { type: 'json' }
// Frontend contract only. A future Skill/API adapter should provide this payload.
export const variableTypes = copy.types
export function variableName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/^<([^<>]*)>$/, '$1').trim() : ''
  if (!name || name.length > 80 || /[<>\r\n\x00-\x1f]/.test(name)) throw new Error(copy.errors.name)
  return name
}
export const variableToken = value => `<${variableName(value)}>`
export function validateTextRange(range, original) {
  if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > original.length || range.text !== original.slice(range.start, range.end)) throw new Error(copy.errors.range)
  // JavaScript/JSON offsets use UTF-16; never allow a boundary inside an emoji.
  for (const position of [range.start, range.end]) if (position > 0 && /[\uD800-\uDBFF]/.test(original[position - 1]) && /[\uDC00-\uDFFF]/.test(original[position] || '')) throw new Error(copy.errors.emoji)
  return range
}
export function demoReview() { return structuredClone(demoPayload) }
export function validateReview(value) {
  if (value?.version !== 1 || !value.deck || !Array.isArray(value.variables)) throw new Error(copy.errors.payload)
  const { deck, variables } = value
  if (typeof deck.title !== 'string' || !Number.isFinite(deck.width) || !Number.isFinite(deck.height) || deck.width <= 0 || deck.height <= 0 || deck.width > 10000 || deck.height > 10000 || !Array.isArray(deck.slides) || !deck.slides.length || deck.slides.length > 100) throw new Error(copy.errors.deck)
  const slideIds = new Set(), targets = new Map()
  const validColor = c => /^#[a-f\d]{6}$/i.test(c || '')
  for (const page of deck.slides) {
    if (typeof page.id !== 'string' || slideIds.has(page.id) || typeof page.name !== 'string' || !validColor(page.background) || !Array.isArray(page.objects) || page.objects.length > 500) throw new Error(copy.errors.slide)
    slideIds.add(page.id); const ids = new Map(); targets.set(page.id, ids)
    for (const o of page.objects) {
      if (typeof o.id !== 'string' || ids.has(o.id) || !['text', 'image', 'rect', 'ellipse'].includes(o.type) || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(o[k])) || o.width <= 0 || o.height <= 0) throw new Error(copy.errors.object)
      if (o.type === 'text' && (typeof o.text !== 'string' || !Number.isFinite(o.fontSize) || o.fontSize <= 0 || !validColor(o.color))) throw new Error(copy.errors.text)
      if (o.fill && o.fill !== 'transparent' && !validColor(o.fill)) throw new Error(copy.errors.fill)
      if (o.type === 'image' && (typeof o.data !== 'string' || !/^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/i.test(o.data))) throw new Error(copy.errors.image)
      ids.set(o.id, o)
    }
  }
  if (variables.length > 10000) throw new Error(copy.errors.tooMany)
  const ids = new Set(), keyTypes = new Map(), bindings = new Map()
  const keyToId = new Map(), idToKey = new Map()
  for (const v of variables) {
    if (v.variableId === undefined) continue
    const key = variableToken(v.label)
    if (typeof v.variableId !== 'string' || !v.variableId.trim() || v.variableId.length > 200) throw new Error(copy.errors.groupId)
    if (keyToId.has(key) && keyToId.get(key) !== v.variableId || idToKey.has(v.variableId) && idToKey.get(v.variableId) !== key) throw new Error(copy.errors.groupMapping)
    keyToId.set(key, v.variableId); idToKey.set(v.variableId, key)
  }
  for (const v of variables) {
    // Accept the previous prototype's keys and types, then export one convention.
    if (['tag', 'number'].includes(v.type)) v.type = 'text'
    const name = variableName(v.label), token = variableToken(name)
    if (v.key !== token && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(v.key || '')) throw new Error(copy.errors.token)
    v.label = name; v.key = token
    v.variableId ??= keyToId.get(v.key) || crypto.randomUUID()
    keyToId.set(v.key, v.variableId); idToKey.set(v.variableId, v.key)
    const object = targets.get(v.slideId)?.get(v.objectId), binding = v.slideId + '/' + v.objectId
    if (typeof v.id !== 'string' || ids.has(v.id) || !Object.hasOwn(variableTypes, v.type) || !object || !['skill', 'manual'].includes(v.source) || typeof v.reviewed !== 'boolean') throw new Error(copy.errors.binding)
    if (keyTypes.has(v.key) && keyTypes.get(v.key) !== v.type) throw new Error(copy.errors.sharedType)
    if ((v.type === 'image') !== (object.type === 'image') || (v.type !== 'image' && object.type !== 'text')) throw new Error(copy.errors.imageTarget)
    const previous = bindings.get(binding) || []
    if (v.type === 'text') {
      // Old results without a range retain their original whole-object meaning.
      v.textRange ??= { start: 0, end: object.text.length, text: object.text }
      validateTextRange(v.textRange, object.text)
      if (previous.some(range => v.textRange.start < range.end && v.textRange.end > range.start)) throw new Error(copy.errors.overlap)
      previous.push(v.textRange)
    } else { if (previous.length) throw new Error(copy.errors.duplicatePhoto); previous.push({}) ; delete v.textRange }
    ids.add(v.id); keyTypes.set(v.key, v.type); bindings.set(binding, previous)
  }
  return value
}
