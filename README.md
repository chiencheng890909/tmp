# 日々 hibi — 簡報欄位設定

Vue 3 + Vite 純前端。介面使用「替換欄位／欄位設定」，保留日系暖白與鼠尾草綠版面。
沒有 JSON 匯入按鈕、檔案下載或匯出功能。

## 執行任務頁

導覽順序為「使用指南 → 執行任務 → 欄位設定」，首頁預設先顯示使用指南。
任務頁只選擇伺服器上的簡報，不提供本機簡報或照片上傳。
下方 input 是 Skill 的執行參數（對象（必填）），前端不把它們綁定或寫入 PPT 文字與照片。對象 輸入一串數字後按 Tab 或 Enter 即收成標籤，游標留在輸入框可繼續輸入下一筆；空白時 Tab 正常切換焦點。標籤可單獨移除，也可貼上多筆數字。數字以字串保留前導零，送出時再序列化為 Tab 分隔字串。

執行後可查看進度、階段、紀錄與回傳結果，支援停止、重試與帶入欄位設定。切換頁面會保留目前任務狀態，重新整理則不保留。
`src/data/presentations.json` 獨立保存示範簡報目錄（ID、名稱、作者、頁數）；搜尋下拉選單可依名稱或作者查找。`src/data/task-options.json` 管理固定 `skillId` 及 Skill 輸入欄位；使用者不需選擇 Skill，`src/locales/zh-TW.json` 的 `tasks` 管理文案。

未接任務服務時為明確標示的示範模式：使用 JSON 中的示範目錄、計時器進度與原樣的示範簡報預覽，不執行 Skill，也不根據輸入修改簡報。

### 未來任務服務接口

在 `public/app-config.json` 設定同源 `taskEndpoint`，例如 `/api/tasks`；預設為 `null`。

- `GET /api/tasks/presentations`：回傳 `{ "presentations": [{ "id": "server-deck-id", "title": "簡報名稱", "author": "作者名稱", "slideCount": 3 }] }`。清單載入失敗可重試，不會退回示範目錄或提交假的簡報 ID。
- `POST /api/tasks`：`application/json`，資料為 `{ "skillId": "…", "presentationId": "server-deck-id", "inputs": { "target": "00123\t00456" } }`；不包含本機檔案、照片或 PPT 物件替換對應。回傳 `{ "id": "task-id" }`。
- `GET /api/tasks/{id}`：前端約每秒輪詢，回傳 `{ "status": "running", "progress": 45, "stageIndex": 1, "message": "處理紀錄" }`。
- `status` 支援 `queued`、`running`、`completed`、`failed`、`cancelled`，`progress` 為 0–100，選填 `stageIndex` 為 0–3。
- 完成時回傳 `{ "status": "completed", "progress": 100, "result": <完整欄位設定資料> }`。前端顯示的是服務回傳內容，不自行把 Skill input 寫入簡報。
- `DELETE /api/tasks/{id}`：請求服務停止任務。前端停止輪詢不保證後端已停止；請求失敗會提示。

尚未建立任務後端或執行 Skill。接口僅在瀏覽器測試以模擬服務驗證。

## 啟動與檢查

```powershell
cd E:\WUI\web\hibi-living
pnpm.cmd install
pnpm.cmd dev
```

```powershell
pnpm.cmd build
pnpm.cmd test:e2e
```

瀏覽器測試使用本機 Microsoft Edge。測試中的 server 是 Playwright 攔截模擬，應用程式不會假裝儲存成功。

## 修改介面文案

`web/hibi-living/src/locales/zh-TW.json` 集中管理：頁面標題、導覽、按鈕、狀態、說明、錯誤、placeholder、alt、aria-label 與使用指南。
Vue 與驗證函式統一讀取此 JSON，動態數值透過 `{count}`、`{page}` 等占位符填入。
本機開發修改 JSON 會熱更新；正式部署需重新建置。

簡報內容與辨識結果不是 UI 文案，示範資料獨立放在 `web/hibi-living/src/data/demo-review.json`；正式資料由 server 提供。

## Server 接口

`web/hibi-living/public/app-config.json` 是執行時設定：

```json
{ "reviewEndpoint": null }
```

預設沒有 API，只顯示示範資料。按「儲存」會明確提示尚未連接服務，不會下載檔案，也不會回報成功。
後端準備好後，設定同源 endpoint，例如：

```json
{ "reviewEndpoint": "/api/reviews/current" }
```

- `GET endpoint`：回傳完整設定 JSON，前端驗證後顯示。
- `PUT endpoint`：接收完整設定 JSON，HTTP 2xx（含 204）代表已儲存；其餘視為失敗。
- 身分驗證可沿用同源 cookie；前端不設定或保存 token。
- 載入失敗顯示重新載入入口。儲存失敗保留目前調整，可重試。
- 「套用修改」只更新前端資料，「儲存」才送至 server。草稿尚未套用時會阻擋儲存。
- 儲存過程中若又有新修改，不會把新修改誤標為已儲存。

目前只完成前端 adapter，**未實作 server、掃描或實際簡報替換**。

## 資料格式

保留 `version: 1`、`deck` 與 `variables` 的技術欄位，避免影響後續串接；使用者介面不顯示這些內部名稱。
完整範例見 `web/hibi-living/src/data/demo-review.json`。

- `deck`：簡報名稱、畫布尺寸與投影片／物件資料。
- `variables[].variableId`：共用欄位 ID，可對應多個文字片段或多張照片，但類型不可混用。
- `variables[].id`：各出現位置的獨立 ID。
- `key`：`<產業名稱>` 等替換標記；`label` 不含括號。同名欄位共用 ID 與替換值。
- `type`：`text` 或 `image`；`slideId`／`objectId`：簡報位置；`reviewed`：各位置確認狀態。
- 文字包含 `textRange: { start, end, text }`，起點包含、終點不包含，`text` 必須符合原文。索引單位為 JavaScript UTF-16 code unit，後端需使用相同單位；不可切開 emoji 代理對。
- 同一文字物件可有多個不重疊片段；同一照片只對應一筆位置紀錄。
- 舊資料缺少 `variableId` 或 `textRange` 時仍有相容處理。

## 版面與原始碼

上方簡報預覽與右側欄位總表上下切齊，下方為滿版校對清單與直接編輯區；總表顯示名稱、Type 與使用位置。

- `src/App.vue`：校對、編輯、群組與儲存狀態。
- `src/lib/copy.js`：讀取文案 JSON 與占位符替換。
- `src/lib/review.js`：資料格式驗證。
- `src/services/reviewService.js`：讀取執行時設定、GET 與 PUT adapter。
- `src/components/SlideCanvas.vue`：簡報與替換標記。
- `src/components/TextRangePicker.vue`：文字片段選取。

示範圖片為本機 SVG。Google Fonts 字體需網路，失敗時使用系統字體。原有 Python 檔案保留，沒有新增 Python 套件。
