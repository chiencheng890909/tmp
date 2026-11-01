<script setup>
import { computed, ref } from 'vue'
import { motion, useReducedMotion } from 'motion-v'
import SlideCanvas from './components/SlideCanvas.vue'
import TaskRunner from './components/TaskRunner.vue'
import TextRangePicker from './components/TextRangePicker.vue'
import copy, { format } from './lib/copy'
import { saveWorkspace } from './services/reviewService'
import { demoReview, validateReview, variableTypes, variableName, variableToken, validateTextRange } from './lib/review'

const props = defineProps({ initialResult: Object, endpoint: { type: String, default: null }, taskEndpoint: { type: String, default: null } })
const result = ref(props.initialResult || demoReview()), activeId = ref(result.value.deck.slides[0].id), selectedId = ref(null)
const selectedVariableId = ref(null)
const deck = computed(() => result.value.deck), variables = computed(() => result.value.variables)
const slide = computed(() => deck.value.slides.find(p => p.id === activeId.value) || deck.value.slides[0])
const selectedObject = computed(() => slide.value.objects.find(o => o.id === selectedId.value))
const selectedVariable = computed(() => variables.value.find(v => v.id === selectedVariableId.value && v.slideId === slide.value.id && v.objectId === selectedId.value))
const pageVariables = computed(() => variables.value.filter(v => v.slideId === slide.value.id))
const reviewedCount = computed(() => variables.value.filter(v => v.reviewed).length)
const filter = ref('all'), search = ref(''), listScope = ref('all'), view = ref('guide'), showMarkers = ref(true)
const shownVariables = computed(() => variables.value.filter(v => (listScope.value === 'all' || v.slideId === slide.value.id) && (filter.value === 'all' || filter.value === 'pending' && !v.reviewed || filter.value === v.type) && (v.label + v.key).toLowerCase().includes(search.value.toLowerCase())))
const variableGroups = computed(() => {
  const groups = new Map()
  for (const v of variables.value) { if (!groups.has(v.variableId)) groups.set(v.variableId, { variableId: v.variableId, key: v.key, type: v.type, locations: [] }); groups.get(v.variableId).locations.push(v) }
  return [...groups.values()]
})
function nextPending() {
  const current = variables.value.findIndex(v => v.id === selectedVariableId.value)
  const ordered = [...variables.value.slice(current + 1), ...variables.value.slice(0, current + 1)]
  const next = ordered.find(v => !v.reviewed); if (next) selectVariable(next)
}
const revision = ref(0)
const reduced = useReducedMotion(), busy = ref(false), editorOpen = ref(false), editing = ref(null), form = ref({}), formError = ref('')
const message = ref(props.endpoint ? copy.messages.loaded : copy.messages.demo), isError = ref(false), undo = ref([]), dirty = ref(false)
function notify(value, error = false) { message.value = value; isError.value = error }
function checkpoint() { undo.value.push(JSON.parse(JSON.stringify(result.value))); if (undo.value.length > 30) undo.value.shift(); dirty.value = true; revision.value++ }
function activate(id) { activeId.value = id; selectedId.value = null; selectedVariableId.value = null; editorOpen.value = false }
function selectVariable(v) { activeId.value = v.slideId; selectedId.value = v.objectId; selectedVariableId.value = v.id; startForm(v) }
function selectObject(id) { selectedId.value = id; const variable = variables.value.find(v => v.slideId === slide.value.id && v.objectId === id); if (variable) selectVariable(variable); else { selectedVariableId.value = null; if (selectedObject.value && ['text', 'image'].includes(selectedObject.value.type)) startForm(); else editorOpen.value = false } }
function restore() { if (!undo.value.length) return; result.value = undo.value.pop(); if (!deck.value.slides.some(p => p.id === activeId.value)) activate(deck.value.slides[0].id); dirty.value = true; revision.value++; if (selectedVariable.value) startForm(selectedVariable.value); else editorOpen.value = false; notify(copy.messages.restored) }
function remove(v) { checkpoint(); result.value.variables = variables.value.filter(item => item.id !== v.id); selectedVariableId.value = null; editorOpen.value = false; notify(format(copy.messages.removed, { name: v.label })) }
function confirm(v) { checkpoint(); v.reviewed = !v.reviewed; notify(format(v.reviewed ? copy.messages.confirmed : copy.messages.pending, { name: v.label })) }
function startForm(v = null) {
  editing.value = v?.id || null
  const target = selectedObject.value && (selectedObject.value.type === 'text' || selectedObject.value.type === 'image' && !selectedVariable.value) ? selectedObject.value.id : ''
  form.value = v ? { ...v, textRange: v.textRange ? { ...v.textRange } : undefined } : { slideId: slide.value.id, objectId: target, type: selectedObject.value?.type === 'image' && target ? 'image' : 'text', label: '', key: '', textRange: null }
  formError.value = ''; editorOpen.value = true
}
const formSlide = computed(() => deck.value.slides.find(p => p.id === form.value.slideId))
const availableObjects = computed(() => (formSlide.value?.objects || []).filter(o => o.type === 'text' || o.type === 'image' && !variables.value.some(v => v.slideId === form.value.slideId && v.objectId === o.id && v.id !== editing.value)))
const formObject = computed(() => formSlide.value?.objects.find(o => o.id === form.value.objectId))
function saveVariable() {
  const wasEditing = Boolean(editing.value)
  form.value.type = formObject.value?.type === 'image' ? 'image' : 'text'
  const value = { ...form.value, label: form.value.label.trim(), key: form.value.key.trim() }
  try { value.label = variableName(value.label); value.key = variableToken(value.label) } catch (error) { formError.value = error.message; return }
  if (!availableObjects.value.some(o => o.id === value.objectId)) { formError.value = copy.errors.target; return }
  if (variables.value.some(v => v.key === value.key && v.id !== editing.value && v.type !== value.type)) { formError.value = copy.errors.sharedType; return }
  if ((value.type === 'image') !== (formObject.value.type === 'image')) { formError.value = copy.errors.imageTarget; return }
  if (value.type === 'text') {
    try { validateTextRange(value.textRange, formObject.value.text) } catch (error) { formError.value = error.message; return }
    if (variables.value.some(v => v.id !== editing.value && v.slideId === value.slideId && v.objectId === value.objectId && v.textRange && value.textRange.start < v.textRange.end && value.textRange.end > v.textRange.start)) { formError.value = copy.errors.overlap; return }
  } else delete value.textRange
  const shared = variables.value.find(v => v.id !== editing.value && v.key === value.key)
  const previousGroup = variables.value.find(v => v.id === editing.value)
  value.variableId = shared?.variableId || (previousGroup && !variables.value.some(v => v.id !== editing.value && v.variableId === previousGroup.variableId) ? previousGroup.variableId : crypto.randomUUID())
  checkpoint()
  if (editing.value) { const previous = variables.value.find(v => v.id === editing.value); Object.assign(previous, value, { reviewed: false }); if (value.type === 'image') delete previous.textRange }
  else { value.id = crypto.randomUUID(); result.value.variables.push({ ...value, source: 'manual', reviewed: false, reason: copy.editor.manualReason }) }
  selectVariable(variables.value.find(v => v.id === value.id)); notify(wasEditing ? copy.messages.updated : copy.messages.added)
}
const formChanged = computed(() => editorOpen.value && editing.value && selectedVariable.value && (form.value.label !== selectedVariable.value.label || form.value.objectId !== selectedVariable.value.objectId || form.value.slideId !== selectedVariable.value.slideId || ['start', 'end', 'text'].some(key => form.value.textRange?.[key] !== selectedVariable.value.textRange?.[key])))
function resetEditor() { if (selectedVariable.value) startForm(selectedVariable.value); else { editorOpen.value = false; formError.value = '' } }
async function saveToServer() {
  if (busy.value) return
  if (formChanged.value || editorOpen.value && !editing.value && form.value.label?.trim()) { notify(copy.errors.draft, true); return }
  busy.value = true
  const sentRevision = revision.value
  try {
    const snapshot = validateReview(JSON.parse(JSON.stringify(result.value)))
    notify(copy.messages.saving)
    await saveWorkspace(props.endpoint, snapshot)
    if (revision.value === sentRevision) { dirty.value = false; notify(copy.messages.saved) }
    else notify(copy.messages.savedWithChanges)
  } catch (error) { notify(error.message, true) }
  finally { busy.value = false }
}
function openTaskResult(data) {
  try { const validated = validateReview(JSON.parse(JSON.stringify(data))); checkpoint(); result.value = validated; activate(validated.deck.slides[0].id); filter.value = 'all'; search.value = ''; listScope.value = 'all'; view.value = 'review'; notify(copy.tasks.opened) }
  catch { notify(copy.tasks.resultError, true) }
}
function pageNumber(v) { return deck.value.slides.findIndex(p => p.id === v.slideId) + 1 }
function pendingCount(group) { return group.locations.filter(v => !v.reviewed).length }
</script>

<template>
  <div class="studio">
    <aside class="rail">
      <a class="brand" href="#main" :aria-label="copy.brand.home">{{ copy.brand.name }}<span>.</span></a>
      <span class="brand-caption">{{ copy.brand.caption }}</span>
      <nav :aria-label="copy.nav.label">
        <button :class="{ active: view === 'guide' }" @click="view = 'guide'"><span aria-hidden="true">☷</span>{{ copy.nav.guide }}</button>
        <button :class="{ active: view === 'tasks' }" @click="view = 'tasks'"><span aria-hidden="true">▷</span>{{ copy.nav.tasks }}</button>
        <button :class="{ active: view === 'review' }" @click="view = 'review'"><span aria-hidden="true">▣</span>{{ copy.nav.review }}</button>
      </nav>
      <div class="rail-bottom"><span aria-hidden="true">✳</span><p class="preserve-lines">{{ copy.brand.motto }}</p><small><i></i>{{ copy.brand.prototype }}</small></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span>{{ copy.nav.workspace }} <b>/</b> {{ view === 'review' ? copy.nav.review : view === 'tasks' ? copy.nav.tasks : copy.nav.guide }}</span><span><i></i>{{ (view === 'tasks' ? taskEndpoint : endpoint) ? copy.nav.connected : copy.nav.disconnected }}</span></header>
      <main id="main">
        <template v-if="view === 'review'">
          <motion.section class="intro" :initial="reduced ? false : { opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: .6 }">
            <div><p class="eyebrow">{{ copy.hero.eyebrow }}</p><h1>{{ copy.hero.title }}<span>{{ copy.hero.accent }}</span></h1><p>{{ copy.hero.description }}</p></div>
            <div class="decoration" aria-hidden="true"><span>{{ copy.hero.japanese }}</span><i></i><b></b></div>
          </motion.section>
          <section class="project-strip">
            <div class="project-name"><span class="file-icon" aria-hidden="true">▤</span><div><h2>{{ deck.title }}</h2><p>{{ format(copy.state.project, { pages: deck.slides.length, state: dirty ? copy.state.dirty : copy.state.clean }) }}</p></div></div>
            <div class="project-actions"><button class="button primary" :disabled="busy" @click="saveToServer">{{ busy ? copy.actions.saving : copy.actions.save }}</button></div>
          </section>
          <section class="review-summary" :aria-label="copy.summary.label">
            <div><span class="summary-number">{{ variableGroups.length }}</span><span>{{ copy.summary.fields }}</span></div>
            <div><span class="summary-number">{{ variables.length - reviewedCount }}</span><span>{{ copy.summary.pending }}</span></div>
            <div><span class="summary-number">{{ reviewedCount }}</span><span>{{ copy.summary.confirmed }}</span></div>
            <p class="preserve-lines">{{ copy.summary.note }}</p>
            <div class="progress-track" role="progressbar" :aria-label="copy.summary.progress" :aria-valuenow="reviewedCount" :aria-valuemax="Math.max(1, variables.length)" aria-valuemin="0"><span :style="{ width: (variables.length ? reviewedCount / variables.length * 100 : 0) + '%' }"></span></div>
          </section>
          <div class="editor review-editor">
            <aside class="slides-panel" :aria-label="copy.slides.label">
              <div class="panel-title"><h2>{{ copy.slides.title }}</h2><span>{{ String(deck.slides.length).padStart(2, '0') }}</span></div>
              <div class="slide-list"><button v-for="(page, index) in deck.slides" :key="page.id" class="thumbnail" :class="{ active: slide.id === page.id }" :aria-current="slide.id === page.id ? 'true' : undefined" @click="activate(page.id)">
                <div class="thumbnail-label"><span>{{ String(index + 1).padStart(2, '0') }}</span><span>{{ format(copy.state.fieldCount, { count: variables.filter(v => v.slideId === page.id).length }) }}</span></div>
                <div class="thumbnail-frame" aria-hidden="true"><SlideCanvas :slide="page" :width="deck.width" :height="deck.height"/></div><p>{{ page.name }}</p>
              </button></div><p class="slide-panel-note preserve-lines">{{ copy.slides.note }}</p>
            </aside>
            <section class="canvas-panel" :aria-label="copy.canvas.label">
              <div class="toolbar"><span class="canvas-mode">{{ copy.canvas.title }} <small>{{ copy.canvas.mode }}</small></span><button class="undo-button" :disabled="!undo.length" @click="restore">{{ copy.actions.undo }}</button></div>
              <div class="canvas-area"><div class="canvas-label"><span>{{ slide.name }}</span><span>{{ format(copy.state.fieldCount, { count: pageVariables.length }) }}</span></div>
                <div class="main-canvas"><SlideCanvas :slide="slide" :width="deck.width" :height="deck.height" :selected-id="selectedId" :markers="showMarkers ? pageVariables : []" :selected-variable-id="selectedVariableId" interactive @select="selectObject" @select-variable="selectVariable"/></div>
                <p class="canvas-tip">{{ copy.canvas.tip }}</p>
              </div>
              <div class="canvas-footer"><label class="marker-toggle"><input v-model="showMarkers" type="checkbox">{{ copy.canvas.showMarkers }}</label><span>{{ format(copy.state.positionProgress, { current: deck.slides.findIndex(p => p.id === slide.id) + 1, total: deck.slides.length }) }}</span></div>
            </section>
            <aside class="totals-panel" :aria-label="copy.table.label">
              <div class="totals-heading"><p class="eyebrow">{{ copy.table.eyebrow }}</p><h2>{{ copy.table.label }} <span>{{ variableGroups.length }}</span></h2><p>{{ format(copy.state.usage, { locations: variables.length, pending: variables.length - reviewedCount }) }}</p></div>
              <div class="totals-table-scroll"><table class="totals-table"><caption class="sr-only">{{ copy.table.caption }}</caption><thead><tr><th scope="col">{{ copy.table.name }}</th><th scope="col">{{ copy.table.type }}</th><th scope="col">{{ copy.table.locations }}</th></tr></thead><tbody>
                <tr v-for="group in variableGroups" :key="group.variableId" class="total-row" :class="{ active: group.variableId === selectedVariable?.variableId }">
                  <th scope="row"><span>{{ group.key }}</span><small>{{ pendingCount(group) ? format(copy.state.pendingLocations, { count: pendingCount(group) }) : copy.state.allConfirmed }}</small></th>
                  <td><span class="table-type" :title="variableTypes[group.type]">{{ group.type }}</span></td>
                  <td><span class="table-count">{{ format(copy.state.locations, { count: group.locations.length }) }}</span><div class="table-locations"><button v-for="v in group.locations" :key="v.id" :class="{ active: selectedVariableId === v.id }" :aria-label="format(copy.state.locationLabel, { name: group.key, page: pageNumber(v) })" @click="selectVariable(v)">{{ format(copy.state.pageLink, { page: pageNumber(v) }) }}</button></div></td>
                </tr><tr v-if="!variableGroups.length"><td colspan="3" class="totals-empty">{{ copy.table.empty }}</td></tr>
              </tbody></table></div>
            </aside>
            <section class="review-workbench" :aria-label="copy.workbench.label">
              <div class="workbench-heading"><div><h2>{{ copy.workbench.title }}</h2><p>{{ format(copy.state.progress, { pending: variables.length - reviewedCount, confirmed: reviewedCount, total: variables.length }) }}</p></div></div>
              <div class="workbench-body">
                <aside class="variables-panel review-queue" :aria-label="copy.workbench.queue">
                  <div class="variables-heading"><div><h2>{{ copy.workbench.queue }}</h2><span>{{ format(copy.state.pendingLocations, { count: variables.length - reviewedCount }) }}</span></div><button class="button outline" @click="startForm()">{{ copy.actions.add }}</button></div>
                  <div class="variable-filters"><label class="sr-only" for="search">{{ copy.workbench.search }}</label><input id="search" v-model="search" :placeholder="copy.workbench.searchPlaceholder" type="search"><div>
                    <label class="sr-only" for="filter">{{ copy.workbench.filter }}</label><select id="filter" v-model="filter"><option value="all">{{ copy.workbench.allTypes }}</option><option value="pending">{{ copy.state.pending }}</option><option v-for="(label, type) in variableTypes" :key="type" :value="type">{{ label }}</option></select>
                    <label class="scope-toggle"><input v-model="listScope" type="checkbox" true-value="page" false-value="all">{{ copy.workbench.thisPage }}</label>
                  </div></div>
                  <div class="variable-list"><button v-for="v in shownVariables" :key="v.id" class="variable-card" :class="{ active: selectedVariable?.id === v.id }" :aria-pressed="selectedVariable?.id === v.id" @click="selectVariable(v)">
                    <div><span class="type-pill">{{ variableTypes[v.type] }}</span><span class="review-state" :class="{ confirmed: v.reviewed }">{{ v.reviewed ? copy.state.confirmed : copy.state.pending }}</span></div><h3 class="variable-token">{{ v.key }}</h3>
                    <p v-if="v.textRange" class="card-excerpt">{{ format(copy.state.quote, { text: v.textRange.text }) }}</p><p>{{ format(copy.state.position, { page: pageNumber(v) }) }} <span>·</span> {{ v.source === 'skill' ? copy.state.scan : copy.state.manual }} <b aria-hidden="true">↗</b></p>
                  </button><div v-if="!shownVariables.length" class="list-empty">{{ copy.workbench.empty }}<p>{{ copy.workbench.emptyHint }}</p><button v-if="search || filter !== 'all' || listScope !== 'all'" @click="search = ''; filter = 'all'; listScope = 'all'">{{ copy.actions.clear }}</button></div></div>
                  <button class="queue-next" :disabled="variables.length === reviewedCount" @click="nextPending">{{ copy.actions.next }}</button>
                </aside>
                <section class="selection-detail inline-editor" role="region" :aria-label="copy.editor.label">
                  <template v-if="editorOpen">
                    <div class="inline-editor-heading"><div><p class="eyebrow">{{ editing ? copy.editor.editEyebrow : copy.editor.newEyebrow }}</p><h3>{{ editing ? copy.editor.editTitle : copy.editor.newTitle }}</h3></div><span v-if="selectedVariable && editing" class="review-state">{{ selectedVariable.reviewed ? copy.state.confirmed : copy.state.pending }}</span></div>
                    <form @submit.prevent="saveVariable">
                      <p v-if="formObject" class="simple-source">{{ format(copy.state.source, { page: deck.slides.findIndex(p => p.id === form.slideId) + 1, type: variableTypes[formObject.type] }) }}</p>
                      <p v-else class="inline-source-hint">{{ copy.editor.sourceHint }}</p>
                      <template v-if="formObject">
                        <TextRangePicker v-if="formObject.type === 'text'" :key="form.slideId + form.objectId" v-model="form.textRange" :text="formObject.text" :token="form.label ? '<' + form.label.replace(/[<>]/g, '') + '>' : ''"/>
                        <img v-else class="source-photo" :src="formObject.data" :alt="copy.editor.imageAlt">
                        <label class="field simple-name"><span v-if="formObject.type === 'text'" class="step-number" aria-hidden="true">2</span>{{ copy.editor.name }}<div class="token-input"><span aria-hidden="true">&lt;</span><input :aria-label="copy.editor.name" v-model="form.label" maxlength="82" required :placeholder="copy.editor.namePlaceholder"><span aria-hidden="true">&gt;</span></div></label>
                        <p class="shared-name-hint">{{ copy.editor.sharedHint }}</p>
                      </template>
                      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
                      <div class="inline-actions"><button class="button outline" type="button" @click="resetEditor">{{ editing ? copy.actions.reset : copy.actions.cancel }}</button><button class="button primary" type="submit" :disabled="!formObject">{{ editing ? copy.actions.apply : copy.actions.addField }}</button></div>
                      <div v-if="selectedVariable && editing" class="inline-review-actions">
                        <button type="button" class="button outline" :disabled="formChanged" @click="confirm(selectedVariable)">{{ selectedVariable.reviewed ? copy.actions.unconfirm : copy.actions.confirm }}</button>
                        <button v-if="selectedObject?.type === 'text'" type="button" class="button outline" @click="startForm()">{{ copy.actions.addRange }}</button>
                        <button type="button" class="remove-variable" @click="remove(selectedVariable)">{{ copy.actions.remove }}</button>
                      </div>
                    </form>
                  </template>
                  <template v-else><p class="eyebrow">{{ copy.editor.emptyEyebrow }}</p><h3>{{ copy.editor.emptyTitle }}</h3><p>{{ copy.editor.emptyHint }}</p></template>
                </section>
              </div>
            </section>
          </div>
          <div class="status" :class="{ error: isError }" role="status" aria-live="polite"><span aria-hidden="true">{{ isError ? '!' : '✓' }}</span>{{ message }}</div>
          <section class="bottom-notes"><div v-for="(item, index) in copy.notes" :key="index"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ item[0] }}</h3><p>{{ item[1] }}</p></div></div></section>
        </template>
        <TaskRunner v-show="view === 'tasks'" :workspace="result" :endpoint="taskEndpoint" @open-result="openTaskResult"/>
        <section v-if="view === 'guide'" class="guide"><p class="eyebrow">{{ copy.guide.eyebrow }}</p><h1>{{ copy.guide.title }}</h1><article v-for="(item, index) in copy.guide.items" :key="index"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><h2>{{ item[0] }}</h2><p>{{ item[1] }}</p></div></article><div class="guide-actions"><button class="button primary" @click="view = 'tasks'">{{ copy.guide.start }}</button><button class="button outline" @click="view = 'review'">{{ copy.actions.back }}</button></div></section>
        <footer><span>{{ copy.brand.footer }}</span><span>{{ copy.brand.japanese }}<b aria-hidden="true">✳</b></span></footer>
      </main>
    </div>
  </div>
</template>

