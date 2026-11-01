# 收件者快速啟動

這是 Vue 3 + Vite 的前端專案，解壓縮後請使用終端機啟動。
請先安裝 Node.js 24 與 pnpm（此專案使用 pnpm 11.18.0 打包）；本專案不需要 Python 環境。

## Linux

解壓縮附件後，在終端機進入專案：

```bash
cd WUI/web
pnpm install --frozen-lockfile
pnpm dev
```

如果已安裝 Node.js，但尚未安裝 pnpm，可先執行：

```bash
npm install --global pnpm@11.18.0
```

開啟終端機顯示的本機網址（通常是 http://127.0.0.1:5173/）。
ZIP 不含 Windows 的 node_modules；Linux 安裝時會下載對應平台的套件。

建置與本機預覽：

```bash
pnpm build
pnpm preview
```

如果是在遠端 Linux 主機啟動，瀏覽器可透過 SSH 通道存取。例如從自己的電腦執行 `ssh -L 5173:127.0.0.1:5173 使用者@主機`，再開啟自己電腦的 http://127.0.0.1:5173/。

## Windows PowerShell

在解壓縮後的 `WUI` 資料夾開啟 PowerShell：

```powershell
cd web
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

開啟終端機顯示的本機網址（通常是 http://127.0.0.1:5173/）。
不要直接雙擊 `index.html`；第一次安裝套件需要網路。
macOS 或 Cygwin 同樣使用不帶 `.cmd` 的 `pnpm` 指令。

## 建置

```powershell
pnpm.cmd build
pnpm.cmd preview
```

## 專案範圍

- 包含完整前端原始碼、套件版本鎖定檔、示範資料與測試。
- 沒有包含 node_modules、Git 歷史、Python 虛擬環境、快取或測試產物，這些不影響重新安裝與開發。
- 預設為示範模式，沒有真正的 Skill 執行或 server 儲存。
- 若要串接服務，請修改 `web/public/app-config.json`，接口說明見 `README.md`。
- 介面文案：`web/src/locales/zh-TW.json`。
- 示範簡報目錄：`web/src/data/presentations.json`。
- Google Fonts 需要網路；無法載入時會使用系統字體。

詳細開發文件請參閱 `README.md`。
