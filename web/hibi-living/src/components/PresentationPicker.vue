<script setup>
import { computed, ref } from 'vue'
import { ComboboxRoot, ComboboxAnchor, ComboboxInput, ComboboxTrigger, ComboboxPortal, ComboboxContent, ComboboxViewport, ComboboxItem, ComboboxItemIndicator } from 'reka-ui'
import copy, { format } from '../lib/copy'
const props = defineProps({ modelValue: String, presentations: Array, disabled: Boolean, loading: Boolean })
const emit = defineEmits(['update:modelValue'])
const query = ref('')
const matches = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return props.presentations.filter(p => `${p.title} ${p.author}`.toLocaleLowerCase().includes(term))
})
function displayValue(id) { return props.presentations.find(p => p.id === id)?.title || '' }
function select(id) { emit('update:modelValue', id); query.value = '' }
</script>
<template>
  <div class="task-field presentation-field"><label for="presentation-search">{{ copy.tasks.presentation }}</label>
    <ComboboxRoot :model-value="modelValue" :disabled="disabled" ignore-filter open-on-focus open-on-click @update:model-value="select" @update:open="query = ''">
      <ComboboxAnchor class="presentation-search-control">
        <span aria-hidden="true" class="presentation-search-icon">⌕</span>
        <ComboboxInput id="presentation-search" :aria-label="copy.tasks.presentation" :display-value="displayValue" :placeholder="loading ? copy.tasks.catalogLoading : copy.tasks.presentationSearch" autocomplete="off" @input="query = $event.target.value"/>
        <ComboboxTrigger type="button" :aria-label="copy.tasks.presentationToggle">⌄</ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal><ComboboxContent class="presentation-dropdown" position="popper" :side-offset="6" align="start">
        <div class="presentation-search-caption">{{ copy.tasks.presentationSearchHint }}</div>
        <ComboboxViewport class="presentation-options">
          <ComboboxItem v-for="presentation in matches" :key="presentation.id" :value="presentation.id" :text-value="presentation.title" class="presentation-option">
            <div><strong>{{ presentation.title }}</strong><small>{{ format(copy.tasks.presentationAuthor, { author: presentation.author }) }} · {{ format(copy.tasks.presentationPages, { pages: presentation.slideCount }) }}</small></div><ComboboxItemIndicator class="presentation-option-check">✓</ComboboxItemIndicator>
          </ComboboxItem>
          <div v-if="!matches.length" class="presentation-no-results" role="status">{{ copy.tasks.presentationNoResults }}</div>
        </ComboboxViewport>
      </ComboboxContent></ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>
