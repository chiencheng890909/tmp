import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

// Own Vite in this process so Windows needs no shell process-tree termination.
const require = createRequire(import.meta.url)
const server = await createServer({ server: { host: '127.0.0.1', port: 5178, strictPort: true } })
try {
  await server.listen()
  const result = await new Promise((resolve, reject) => {
    const runner = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)], { stdio: 'inherit' })
    runner.once('error', reject)
    runner.once('exit', code => resolve(code ?? 1))
  })
  process.exitCode = result
} finally {
  await server.close()
}
