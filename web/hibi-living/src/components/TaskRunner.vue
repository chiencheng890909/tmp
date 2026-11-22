<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import copy, { format } from '../lib/copy'
import options from '../data/task-options.json'
import catalog from '../data/presentations.json'
import PresentationPicker from './PresentationPicker.vue'
import { createTask, getTask, cancelTask, demoTaskResult, loadPresentations } from '../services/taskService'
import SlideCanvas from './SlideCanvas.vue'
import { validateTaskInputs } from '../lib/taskInputs'
import TargetTagInput from './TargetTagInput.vue'

const props = defineProps({ workspace: Object, endpoint: { type: String, default: null } })
const emit = defineEmits(['open-result'])
const presentations = ref(props.endpoint ? [] : catalog.presentations), presentationId = ref(''), catalogLoading = ref(false), catalogError = ref('')
const selectedPresentation = computed(() => presentations.value.find(p => p.id === presentationId.value))
const sentPresentationTitle = ref('')
async function refreshPresentations() {
  if (!props.endpoint) return
  catalogLoading.value = true; catalogError.value = ''
  try { presentations.value = await loadPresentations(props.endpoint); presentationId.value = '' }
  catch { presentations.value = []; presentationId.value = ''; catalogError.value = copy.tasks.catalogError }
  finally { catalogLoading.value = false }
}
onMounted(refreshPresentations)
const inputs = ref(Object.fromEntries(options.fields.map(field => [field.key, ''])))
const targetEditor = ref(null)
function setTargetEditor(element) { targetEditor.value = element }
const state = ref('idle'), progress = ref(0), stage = ref(0), logs = ref([]), error = ref(''), result = ref(null), pageIndex = ref(0)
const active = computed(() => ['queued', 'running'].includes(state.value))
const stateLabel = computed(() => ({ idle: copy.tasks.idle, queued: copy.tasks.queued, running: copy.tasks.working, completed: copy.tasks.completed, cancelled: copy.tasks.cancelled, failed: copy.tasks.failed })[state.value])
const sentInputs = ref({}), jobId = ref(null)
let timer, controller, run = 0
function log(text) { logs.value.push({ id: logs.value.length, text, time: new Date().toLocaleTimeString(copy.meta.language, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }) }
function fail(id, message) { if (id !== run) return; state.value = 'failed'; error.value = message; log(message); clearTimeout(timer) }
async function poll(id) {
  try {
    const update = await getTask(props.endpoint, jobId.value, controller.signal)
    if (id !== run) return
    state.value = update.status; progress.value = Math.max(progress.value, update.progress)
    stage.value = Math.min(3, Math.max(0, update.stageIndex ?? Math.floor(update.progress / 30)))
    if (typeof update.message === 'string' && update.message && logs.value.at(-1)?.text !== update.message) log(update.message)
    if (update.status === 'completed') { progress.value = 100; stage.value = 3; result.value = update.result || null; log(copy.tasks.completed) }
    else if (update.status === 'failed') fail(id, copy.tasks.networkError)
    else if (update.status === 'cancelled') log(copy.tasks.cancelNotice)
    else timer = setTimeout(() => poll(id), 1000)
  } catch (e) { if (e.name !== 'AbortError') fail(id, copy.tasks.networkError) }
}
async function start() {
  if (active.value) return
  if (targetEditor.value && !targetEditor.value.commit()) return
  if (options.fields.some(field => field.required && !inputs.value[field.key].trim()) || !selectedPresentation.value || catalogLoading.value) { error.value = copy.tasks.required; return }
  let validatedInputs
  try { validatedInputs = validateTaskInputs(inputs.value) } catch (e) { error.value = e.message; return }
  const id = ++run
  controller?.abort(); clearTimeout(timer); controller = new AbortController()
  state.value = 'queued'; progress.value = 0; stage.value = 0; logs.value = []; result.value = null; pageIndex.value = 0; error.value = ''; jobId.value = null
  sentInputs.value = validatedInputs
  sentPresentationTitle.value = selectedPresentation.value.title
  const snapshot = JSON.parse(JSON.stringify(props.workspace))
  log(copy.tasks.stages[0].description)
  if (!props.endpoint) {
    const tick = async step => {
      if (id !== run) return
      state.value = step === 4 ? 'completed' : 'running'; progress.value = [0, 18, 45, 78, 100][step]; stage.value = Math.min(3, step - 1)
      log(copy.tasks.stages[stage.value].description)
      if (step === 4) {
        try { result.value = demoTaskResult(snapshot) } catch { fail(id, copy.tasks.resultError) }
      } else timer = setTimeout(() => tick(step + 1), 1000)
    }
    timer = setTimeout(() => tick(1), 700)
    return
  }
  try {
    const created = await createTask(props.endpoint, { skillId: options.skillId, presentationId: presentationId.value, inputs: sentInputs.value }, controller.signal)
    if (id !== run) { cancelTask(props.endpoint, created).catch(() => {}); return }
    jobId.value = created; await poll(id)
  } catch (e) { if (e.name !== 'AbortError') fail(id, copy.tasks.networkError) }
}
async function stop() {
  const stoppedRun = ++run; clearTimeout(timer); controller?.abort(); state.value = 'cancelled'; log(copy.tasks.cancelNotice)
  if (props.endpoint && jobId.value) { try { await cancelTask(props.endpoint, jobId.value) } catch { if (stoppedRun === run) error.value = copy.tasks.cancelFailed } }
}
onBeforeUnmount(() => { ++run; clearTimeout(timer); controller?.abort() })
</script>

<template>
  <section class="task-page">
    <div class="task-intro"><p class="eyebrow">{{ copy.tasks.eyebrow }}</p><h1>{{ copy.tasks.title }}<span>{{ copy.tasks.accent }}</span></h1><p>{{ copy.tasks.description }}</p></div>
    <div class="task-notice" :class="{ connected: endpoint }"><span class="task-mode">{{ endpoint ? copy.tasks.liveBadge : copy.tasks.demoBadge }}</span><p v-if="!endpoint">{{ copy.tasks.demoNotice }}</p></div>
    <div class="task-columns">
      <form class="task-form" @submit.prevent="start"><h2>{{ copy.tasks.formTitle }}</h2>
        <fieldset :disabled="active">
          <PresentationPicker v-model="presentationId" :presentations="presentations" :disabled="active || catalogLoading || !presentations.length" :loading="catalogLoading"/>
          <p v-if="catalogError" class="form-error" role="alert">{{ catalogError }}</p><button v-if="catalogError" class="button outline" type="button" @click="refreshPresentations">{{ copy.tasks.catalogRetry }}</button>
          <p v-else-if="!catalogLoading && !presentations.length" class="task-field-note">{{ copy.tasks.catalogEmpty }}</p>
          <div v-if="selectedPresentation" class="task-current-deck"><span aria-hidden="true">▤</span><div><strong>{{ selectedPresentation.title }}</strong><small>{{ format(copy.tasks.presentationMeta, { pages: selectedPresentation.slideCount, author: selectedPresentation.author }) }}</small></div></div>
          <h3>{{ copy.tasks.inputTitle }}</h3><p class="task-field-note">{{ copy.tasks.inputHint }}</p>
          <div v-for="field in options.fields" :key="field.key" class="task-field">
            <label :for="'task-input-' + field.key">{{ field.label }}<span v-if="field.required" aria-hidden="true"> *</span></label>
            <TargetTagInput v-if="field.type === 'target-tags'" :ref="setTargetEditor" :id="'task-input-' + field.key" v-model="inputs[field.key]" :label="field.label" :disabled="active" :max-length="field.maxLength"/>
            <textarea v-else-if="field.type === 'textarea'" :id="'task-input-' + field.key" v-model="inputs[field.key]" :aria-label="field.label" :required="field.required" :maxlength="field.maxLength" :placeholder="field.placeholder" rows="3" spellcheck="false"></textarea>
            <input v-else :id="'task-input-' + field.key" v-model="inputs[field.key]" :aria-label="field.label" :type="field.type" :required="field.required" :maxlength="field.maxLength" :placeholder="field.placeholder">

          </div>

        </fieldset>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="task-submit"><button class="button primary" type="submit" :disabled="active || catalogLoading || !selectedPresentation">{{ active ? copy.tasks.running : state === 'idle' ? copy.tasks.start : copy.tasks.retry }}</button><button v-if="active" class="button outline" type="button" @click="stop">{{ copy.tasks.cancel }}</button></div>
      </form>
      <section class="task-progress" :aria-label="copy.tasks.progressTitle" aria-live="polite">
        <div class="task-progress-heading"><h2>{{ copy.tasks.progressTitle }}</h2><span :class="['task-state', state]">{{ stateLabel }}</span></div>
        <div class="task-percent"><strong>{{ progress }}<small>%</small></strong><span>{{ state === 'idle' ? copy.tasks.idleHint : copy.tasks.stages[stage].title }}</span></div>
        <div class="task-progress-track" role="progressbar" :aria-label="copy.tasks.progressLabel" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: progress + '%' }"></span></div>
        <ol class="task-stages" :aria-label="copy.tasks.stageLabel"><li v-for="(item, index) in copy.tasks.stages" :key="item.id" :class="{ done: state === 'completed' || index < stage, current: state !== 'idle' && index === stage }"><span>{{ state === 'completed' || index < stage ? '✓' : String(index + 1).padStart(2, '0') }}</span><div><h3>{{ item.title }}</h3><p>{{ item.description }}</p></div></li></ol>
        <div class="task-log"><h3>{{ copy.tasks.activity }}</h3><p v-if="!logs.length">{{ copy.tasks.noLogs }}</p><ol><li v-for="entry in logs" :key="entry.id"><time>{{ entry.time }}</time><span>{{ entry.text }}</span></li></ol></div>
      </section>
    </div>
    <section v-if="state === 'completed'" class="task-result" :aria-label="copy.tasks.resultTitle">
      <div class="task-result-heading"><div><p class="eyebrow">{{ copy.tasks.resultTitle }}</p><h2>{{ sentPresentationTitle }}</h2><p>{{ endpoint ? copy.tasks.resultReady : copy.tasks.resultDemo }}</p></div><button v-if="result" class="button primary" @click="emit('open-result', result)">{{ copy.tasks.openResult }}</button></div>
      <template v-if="result"><div class="task-result-layout"><div class="task-result-canvas" :aria-label="copy.tasks.previewLabel"><SlideCanvas :slide="result.deck.slides[pageIndex]" :width="result.deck.width" :height="result.deck.height"/></div><div class="task-input-summary"><h3>{{ copy.tasks.inputSummary }}</h3><dl><template v-for="field in options.fields" :key="field.key"><dt v-if="sentInputs[field.key]">{{ field.label }}</dt><dd v-if="sentInputs[field.key]">{{ sentInputs[field.key] }}</dd></template></dl></div></div><div class="task-result-pagination"><button class="button outline" :disabled="pageIndex === 0" @click="pageIndex--">{{ copy.tasks.previous }}</button><span>{{ format(copy.tasks.page, { current: pageIndex + 1, total: result.deck.slides.length }) }}</span><button class="button outline" :disabled="pageIndex >= result.deck.slides.length - 1" @click="pageIndex++">{{ copy.tasks.next }}</button></div><p class="task-replace-note">{{ copy.tasks.replaceNotice }}</p></template><p v-else class="task-replace-note">{{ copy.tasks.resultEmpty }}</p>
    </section>
  </section>
</template>
