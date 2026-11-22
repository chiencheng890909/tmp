<script setup>
import { computed, ref, watch } from 'vue'
import copy from '../lib/copy'
const props = defineProps({ text: { type: String, default: '' }, modelValue: Object, token: String })
const emit = defineEmits(['update:modelValue'])
const input = ref()
const valid = computed(() => props.modelValue && props.modelValue.start >= 0 && props.modelValue.end > props.modelValue.start && props.modelValue.end <= props.text.length)
function capture(event) {
  const { selectionStart: start, selectionEnd: end } = event.target
  if (props.modelValue?.start === start && props.modelValue?.end === end) return
  if (end > start) emit('update:modelValue', { start, end, text: props.text.slice(start, end) })
}
watch([() => props.modelValue, () => props.text, input], () => {
  if (!input.value) return
  const start = props.modelValue?.start ?? 0, end = props.modelValue?.end ?? 0
  if (input.value.selectionStart !== start || input.value.selectionEnd !== end) input.value.setSelectionRange(start, end)
}, { flush: 'post' })
function selectAll() { input.value.focus(); input.value.setSelectionRange(0, props.text.length); capture({ target: input.value }) }
</script>
<template><section class="range-picker"><div class="range-heading"><label for="source-text"><span class="step-number" aria-hidden="true">1</span>{{ copy.range.label }}</label><button type="button" @click="selectAll">{{ copy.range.all }}</button></div><p>{{ copy.range.hint }}</p><textarea id="source-text" :aria-label="copy.range.label" ref="input" :value="text" readonly rows="3" spellcheck="false" @select="capture" @mouseup="capture" @keyup="capture" @touchend="capture"></textarea><div v-if="valid" class="range-preview" :aria-label="copy.range.preview">{{ text.slice(0, modelValue.start) }}<mark>{{ token || copy.range.token }}</mark>{{ text.slice(modelValue.end) }}</div></section></template>
