// 抓包验证：记录发往本服务的请求头（用于确认 x-opencode-session 注入）。
// 用法：node scripts/capture-headers.mjs [port] [outFile]
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'

const port = Number(process.argv[2] ?? 8399)
const out = process.argv[3] ?? '/tmp/dsh-header-capture.log'

createServer((req, res) => {
  const stamp = new Date().toISOString()
  const lines = [
    `=== ${stamp} ${req.method} ${req.url}`,
    ...Object.entries(req.headers).map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.join(', ') : v}`),
  ]
  appendFileSync(out, lines.join('\n') + '\n')
  // 不追求成功响应：401 即可，只要请求头已记录。
  res.writeHead(401, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'capture-only', type: 'capture' } }))
}).listen(port, '127.0.0.1', () => {
  console.log(`capture listening on http://127.0.0.1:${port} → ${out}`)
})