/**
 * dsh-model-provider-headers — Host half (minimal).
 *
 * 本插件的功能完全在 Client 端：读/写 `llm-pi-ai` 命名空间的请求头走官方
 * Remote 通道（ctx.remote.settings.*）。Host 这里只保留一个空插件入口，
 * 让 loader 的 `exports["."]` 解析成立（client-only 插件也必须有 `.` 入口）。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = '@dsh-external/dsh-model-provider-headers'

export interface Config {}

export const Config = {}

export function apply(ctx: Context): void {
  // 无 host 逻辑。功能与数据均在浏览器端经 Remote 通道完成。
  ctx.logger?.debug?.('dsh-model-provider-headers: host half is a no-op (client-only plugin)')
}