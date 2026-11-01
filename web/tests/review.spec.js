import { test, expect } from '@playwright/test'
import { demoReview } from '../src/lib/review.js'
import copy from '../src/lib/copy.js'
import { readFile } from 'node:fs/promises'

// Only this test adapter simulates a server. The application has no mock save.
async function connect(page, data = demoReview()) {
  const server = { data, saves: [], fail: false }
  await page.route('**/app-config.json', route => route.fulfill({ json: { reviewEndpoint: '/api/review' } }))
  await page.route('**/api/review', async route => {
    if (route.request().method() === 'PUT') {
      server.saves.push(route.request().postDataJSON())
      if (server.fail) return route.fulfill({ status: 500 })
      server.data = server.saves.at(-1)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: server.data })
  })
  await page.goto('/')
  await openReview(page)
  return server
}
async function openReview(page) { await page.getByRole('navigation', { name: copy.nav.label }).getByRole('button', { name: copy.nav.review, exact: true }).click() }
const editor = page => page.getByRole('region', { name: copy.editor.label, exact: true })
async function choose(page, start, end) {
  await page.getByLabel(copy.range.label).evaluate((el, range) => { el.focus(); el.setSelectionRange(...range); el.dispatchEvent(new Event('select', { bubbles: true })) }, [start, end])
}
async function save(page) { await page.getByRole('button', { name: copy.actions.save, exact: true }).click(); await expect(page.locator('.status')).toContainText(copy.messages.saved) }

test('套用欄位、復原與 server 儲存，畫面沒有 JSON 匯入或匯出入口', async ({ page }, info) => {
  const server = await connect(page), errors = []; page.on('pageerror', e => errors.push(e.message))
  await expect(page.getByRole('button', { name: /JSON|匯出|下載/ })).toHaveCount(0)
  await expect(page.locator('.project-strip input[type=file]')).toHaveCount(0)
  await page.locator('.variable-card').filter({ hasText: '<頁尾文字>' }).click()
  const objects = await page.locator('.main-canvas .slide-object').count()
  await page.getByRole('button', { name: copy.actions.remove, exact: true }).click()
  await expect(page.locator('.variable-card')).toHaveCount(5)
  await expect(page.locator('.main-canvas .slide-object')).toHaveCount(objects)
  await page.getByRole('button', { name: copy.actions.undo }).click()
  await expect(page.locator('.variable-card')).toHaveCount(6)
  await page.locator('.main-canvas .slide-object').filter({ hasText: '把自然，' }).click()
  await editor(page).getByLabel(copy.editor.name, { exact: true }).fill('提案主標題')
  await page.getByRole('button', { name: copy.range.all, exact: true }).click()
  await page.getByRole('button', { name: copy.actions.addField, exact: true }).click()
  await page.getByRole('button', { name: copy.actions.confirm }).click()
  await save(page)
  expect(server.saves).toHaveLength(1)
  expect(server.saves[0].variables.find(v => v.key === '<提案主標題>')).toMatchObject({ type: 'text', source: 'manual', reviewed: true, textRange: { start: 0, text: '把自然，\n帶進每一天。' } })
  await expect(page.locator('.project-name')).toContainText(copy.state.clean)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true })
})

test('照片共用 ID 的設定儲存後可由 server 重新載入', async ({ page }) => {
  const server = await connect(page)
  await page.locator('.variable-card').filter({ hasText: '<內頁情境照片>' }).click()
  await page.getByLabel(copy.editor.name, { exact: true }).fill('封面情境照片')
  await page.getByRole('button', { name: copy.actions.apply, exact: true }).click()
  await save(page)
  const photos = server.saves[0].variables.filter(v => v.key === '<封面情境照片>')
  expect(photos).toHaveLength(2)
  expect(photos[0].variableId).toBe(photos[1].variableId)
  expect(photos[0].id).not.toBe(photos[1].id)
  await page.reload()
  await openReview(page)
  const row = page.getByRole('complementary', { name: copy.table.label }).getByRole('row').filter({ hasText: '<封面情境照片>' })
  await expect(row).toContainText('2 處')
  await expect(row.getByRole('button')).toHaveCount(2)
})

test('滿版校對區與預覽總表切齊，剩餘數量可連續操作', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await connect(page)
  await page.locator('.variable-card').first().click()
  const queue = await page.locator('.review-queue').boundingBox(), form = await editor(page).boundingBox()
  expect(Math.abs(queue.y - form.y)).toBeLessThan(2)
  const full = await page.locator('.review-editor').boundingBox(), workbench = await page.locator('.review-workbench').boundingBox()
  expect(Math.abs(full.width - workbench.width)).toBeLessThan(3)
  const canvas = await page.locator('.canvas-panel').boundingBox(), totals = await page.locator('.totals-panel').boundingBox()
  expect(Math.abs(canvas.y + canvas.height - totals.y - totals.height)).toBeLessThan(2)
  await expect(page.getByRole('columnheader', { name: copy.table.type, exact: true })).toBeVisible()
  await expect(page.locator('.workbench-heading')).toContainText('6 處待確認')
  await page.getByRole('button', { name: copy.actions.confirm }).click()
  await page.getByRole('button', { name: copy.actions.next }).click()
  await expect(page.getByLabel(copy.editor.name, { exact: true })).toHaveValue('封面產業標籤')
  await page.getByRole('button', { name: copy.actions.remove, exact: true }).click()
  await expect(page.locator('.workbench-heading')).toContainText('4 處待確認')
  await page.screenshot({ path: info.outputPath('workbench.png'), fullPage: true })
})

test('同名不同類型會阻擋，無效 server 資料顯示重新載入', async ({ page }) => {
  const server = await connect(page)
  await page.locator('.variable-card').filter({ hasText: '<提案數量>' }).click()
  await page.getByLabel(copy.editor.name, { exact: true }).fill('封面情境照片')
  await page.getByRole('button', { name: copy.actions.apply, exact: true }).click()
  await expect(editor(page).getByRole('alert')).toContainText(copy.errors.sharedType)
  const valid = structuredClone(server.data)
  server.data.variables[0].objectId = 'missing'
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(copy.errors.loadFailed)
  server.data = valid
  await page.getByRole('button', { name: copy.actions.retry, exact: true }).click()
  await openReview(page)
  await expect(page.locator('.variable-card')).toHaveCount(6)
})

test('手機版可直接編輯，文案沒有內部用語且無水平溢出', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await connect(page)
  await page.getByRole('button', { name: '查看欄位：封面產業標籤', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel(copy.editor.name, { exact: true }).fill('產業分類')
  await page.getByRole('button', { name: copy.actions.apply, exact: true }).click()
  await expect(page.getByLabel(copy.editor.name, { exact: true })).toHaveValue('產業分類')
  await expect(page.locator('body')).not.toContainText('變因')
  await expect(page.locator('body')).not.toContainText('控制')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true })
})

test('相同詞語的兩個位置可共用欄位，重疊範圍會阻擋', async ({ page }) => {
  const original = '為生活選品與生活選品打造提案。', data = demoReview()
  data.deck.slides[0].objects.find(o => o.id === 's1-description').text = original
  const server = await connect(page, data)
  await page.locator('.main-canvas .slide-object').filter({ hasText: original }).click()
  await page.getByLabel(copy.editor.name, { exact: true }).fill('產業')
  await page.getByRole('button', { name: copy.actions.addField, exact: true }).click()
  await expect(editor(page).getByRole('alert')).toContainText(copy.errors.range)
  await choose(page, 1, 5)
  await expect(page.getByLabel(copy.range.preview)).toHaveText('為<產業>與生活選品打造提案。')
  await page.getByRole('button', { name: copy.actions.addField, exact: true }).click()
  await page.getByRole('button', { name: copy.actions.addRange }).click()
  await page.getByLabel(copy.editor.name, { exact: true }).fill('產業')
  await choose(page, 6, 10)
  await page.getByRole('button', { name: copy.actions.addField, exact: true }).click()
  await page.getByRole('button', { name: copy.actions.addRange }).click()
  await page.getByLabel(copy.editor.name, { exact: true }).fill('重疊片段')
  await choose(page, 2, 4)
  await page.getByRole('button', { name: copy.actions.addField, exact: true }).click()
  await expect(editor(page).getByRole('alert')).toContainText(copy.errors.overlap)
  await page.getByRole('button', { name: copy.actions.cancel, exact: true }).click()
  await save(page)
  const shared = server.saves[0].variables.filter(v => v.key === '<產業>')
  expect(shared).toHaveLength(2)
  expect(new Set(shared.map(v => v.id)).size).toBe(2)
  expect(new Set(shared.map(v => v.variableId)).size).toBe(1)
  expect(shared.map(v => v.textRange)).toEqual([{ start: 1, end: 5, text: '生活選品' }, { start: 6, end: 10, text: '生活選品' }])
  await page.reload()
  await openReview(page)
  await page.locator('.variable-card').filter({ hasText: '<產業>' }).last().click()
  await page.getByRole('button', { name: copy.actions.remove, exact: true }).click()
  await expect(page.locator('.variable-card').filter({ hasText: '<產業>' })).toHaveCount(1)
})

test('未接服務不會假裝儲存；失敗可重試且不遺失調整', async ({ page }) => {
  await page.goto('/')
  await openReview(page)
  await page.getByRole('button', { name: copy.actions.save, exact: true }).click()
  await expect(page.locator('.status')).toContainText(copy.errors.serverUnavailable)
  const server = await connect(page)
  await page.locator('.variable-card').first().click()
  await page.getByLabel(copy.editor.name, { exact: true }).fill('新的照片名稱')
  await page.getByRole('button', { name: copy.actions.save, exact: true }).click()
  await expect(page.locator('.status')).toContainText(copy.errors.draft)
  expect(server.saves).toHaveLength(0)
  await page.getByRole('button', { name: copy.actions.apply, exact: true }).click()
  server.fail = true
  await page.getByRole('button', { name: copy.actions.save, exact: true }).click()
  await expect(page.locator('.status')).toContainText(copy.errors.saveFailed)
  await expect(page.locator('.project-name')).toContainText(copy.state.dirty)
  await expect(page.getByLabel(copy.editor.name, { exact: true })).toHaveValue('新的照片名稱')
  server.fail = false
  await save(page)
  await expect(page.locator('.project-name')).toContainText(copy.state.clean)
})

test('Vue 介面與驗證訊息不再硬寫中文文案', async () => {
  for (const file of ['App.vue', 'components/SlideCanvas.vue', 'components/TextRangePicker.vue', 'components/TaskRunner.vue', 'components/PresentationPicker.vue', 'components/TargetTagInput.vue', 'services/taskService.js', 'lib/review.js']) {
    const source = await readFile(new URL('../src/' + file, import.meta.url), 'utf8')
    expect(source).not.toMatch(/\p{Script=Han}/u)
  }
})
