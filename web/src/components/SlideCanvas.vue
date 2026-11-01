<script setup>
import copy, { format } from '../lib/copy'
const props = defineProps({ slide: Object, width: Number, height: Number, selectedId: String, selectedVariableId: String, interactive: Boolean, markers: { type: Array, default: () => [] } })
const emit = defineEmits(['select', 'select-variable'])
function style(o) { return { left: o.x / props.width * 100 + '%', top: o.y / props.height * 100 + '%', width: o.width / props.width * 100 + '%', height: o.height / props.height * 100 + '%', fontSize: o.fontSize / props.width * 100 + 'cqw', color: o.color, background: o.fill || 'transparent', borderRadius: o.type === 'ellipse' ? '50%' : '0' } }
function parts(o) {
  const ranges = props.interactive ? props.markers.filter(v => v.objectId === o.id && v.textRange).sort((a, b) => a.textRange.start - b.textRange.start) : []
  const result = []; let cursor = 0
  for (const v of ranges) { result.push({ text: o.text.slice(cursor, v.textRange.start) }); result.push({ text: o.text.slice(v.textRange.start, v.textRange.end), variable: v }); cursor = v.textRange.end }
  result.push({ text: o.text.slice(cursor) }); return result
}
function markerPosition(v) {
  const object = props.slide.objects.find(o => o.id === v.objectId)
  const same = props.markers.filter(item => item.objectId === v.objectId), offset = same.findIndex(item => item.id === v.id) * 23
  return { left: `min(94%, calc(${Math.max(0, (object?.x || 0) / props.width * 100)}% + ${offset}px))`, top: Math.min(94, Math.max(0, (object?.y || 0) / props.height * 100 - 3)) + '%' }
}
</script>
<template><div class="slide-canvas" :style="{ aspectRatio: `${width} / ${height}`, background: slide.background }" @click.self="interactive && emit('select', null)"><component :is="interactive ? 'button' : 'div'" v-for="(o, i) in slide.objects" :key="o.id" class="slide-object" :class="{ selected: interactive && selectedId === o.id, marked: interactive && markers.some(v => v.objectId === o.id) }" :style="style(o)" :aria-label="interactive ? (o.type === 'text' ? format(copy.canvas.selectText, { text: o.text }) : format(copy.canvas.selectObject, { index: i + 1 })) : undefined" :aria-pressed="interactive ? selectedId === o.id : undefined" @click.stop="interactive && emit('select', o.id)"><img v-if="o.type === 'image'" :src="o.data" :alt="copy.canvas.imageAlt" draggable="false"><template v-else-if="o.type === 'text'"><template v-for="(part, j) in parts(o)" :key="j"><mark v-if="part.variable" :class="{ 'active-range': part.variable.id === selectedVariableId }" :title="part.variable.key" @click.stop="emit('select-variable', part.variable)">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></template></component><template v-if="interactive"><button v-for="(v, i) in markers" :key="v.id" class="variable-marker" :class="{ reviewed: v.reviewed }" :style="markerPosition(v)" :aria-label="format(copy.canvas.markerLabel, { name: v.label })" @click.stop="emit('select-variable', v)">{{ i + 1 }}</button></template></div></template>
