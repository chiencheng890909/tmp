import copy from '../locales/zh-TW.json' with { type: 'json' }
export default copy
export function format(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match)
}
