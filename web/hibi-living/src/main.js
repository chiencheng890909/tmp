import { createApp, h } from 'vue'
import App from './App.vue'
import copy from './lib/copy'
import { loadWorkspace } from './services/reviewService'
import './style.css'
import './review.css'
import './ranges.css'
import './workbench.css'
import './tasks.css'
import './target-tags.css'
import './presentation-picker.css'
document.documentElement.lang = copy.meta.language
document.title = copy.meta.title
const description = document.createElement('meta')
description.name = 'description'
description.content = copy.meta.description
document.head.appendChild(description)

async function start() {
  try {
    const { data, endpoint, taskEndpoint } = await loadWorkspace()
    createApp(App, { initialResult: data, endpoint, taskEndpoint }).mount('#app')
  } catch {
    createApp({ render: () => h('main', { class: 'startup-error', role: 'alert' }, [
      h('h1', copy.errors.loadFailed),
      h('button', { class: 'button primary', onClick: () => window.location.reload() }, copy.actions.retry),
    ]) }).mount('#app')
  }
}
start()
