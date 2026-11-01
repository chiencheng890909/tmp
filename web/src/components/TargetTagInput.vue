<script setup>
import { computed, ref } from 'vue'
import copy, { format } from '../lib/copy'
const props = defineProps({ modelValue: { type: String, default: '' }, id: String, label: String, disabled: Boolean, maxLength: { type: Number, default: 20000 } })
const emit = defineEmits(['update:modelValue'])
const draft = ref(''), input = ref(), error = ref('')
const tags = computed(() => props.modelValue ? props.modelValue.split('\t') : [])
function add(values) {
  if (values.some(value => !/^\d+$/.test(value)) || [...tags.value, ...values].join('\t').length > props.maxLength) { error.value = copy.tasks.targetError; return false }
  emit('update:modelValue', [...tags.value, ...values].join('\t')); error.value = ''; return true
}
function commit() {
  if (!draft.value.trim()) return !error.value
  if (!add(draft.value.trim().split(/[\t\r\n]+/).map(value => value.trim()))) return false
  draft.value = ''; return true
}
function keydown(event) {
  if (event.isComposing || props.disabled) return
  if ((event.key === 'Tab' && !event.shiftKey && draft.value.trim()) || event.key === 'Enter') { event.preventDefault(); commit() }
  if (event.key === 'Backspace' && !draft.value && tags.value.length) { event.preventDefault(); remove(tags.value.length - 1) }
}
function paste(event) {
  const value = event.clipboardData.getData('text')
  if (!/[\t\r\n]/.test(value)) return
  event.preventDefault()
  const text = draft.value.slice(0, input.value.selectionStart) + value + draft.value.slice(input.value.selectionEnd)
  const values = text.trim().split(/[\t\r\n]+/).map(item => item.trim())
  if (add(values)) draft.value = ''
}
function remove(index) { if (props.disabled) return; emit('update:modelValue', tags.value.filter((_, i) => i !== index).join('\t')); error.value = ''; input.value.focus() }
defineExpose({ commit })
</script>
<template>
  <div class="target-tag-control" :class="{ invalid: error }" @click.self="input.focus()">
    <span v-for="(tag, index) in tags" :key="index + '-' + tag" class="target-tag"><span>{{ tag }}</span><button type="button" :disabled="disabled" :aria-label="format(copy.tasks.removeTarget, { target: tag, index: index + 1 })" @click="remove(index)">×</button></span>
    <input :id="id" ref="input" v-model="draft" :aria-label="label" type="text" inputmode="numeric" autocomplete="off" :disabled="disabled" :required="!tags.length" :maxlength="maxLength" :placeholder="tags.length ? copy.tasks.targetNext : copy.tasks.targetPlaceholder" :aria-invalid="!!error" :aria-describedby="id + '-hint'" @input="error = ''" @keydown="keydown" @paste="paste" @blur="commit">
  </div>
  <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  <div class="target-tag-footer"><p :id="id + '-hint'">{{ copy.tasks.targetHint }}</p><span>{{ format(copy.tasks.targetCount, { count: tags.length }) }}</span></div>
</template>
