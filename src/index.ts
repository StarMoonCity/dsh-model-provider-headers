/**
 * dsh-model-provider-headers — Host half (minimal).
 *
 * 本插件的功能完全在 Client 端：读/写 `llm-pi-ai` 命名空间的请求头走官方
 * Remote 通道（ctx.remote.settings.*）。Host 这里只保留一个空插件入口，
 * 让 loader 的 `exports["."]` 解析成立（client-only 插件也必须有 `.` 入口）。
 *
 * ⚠️ 不要导出 `Config`：cordis 会对导出的 Config 走 Standard Schema 校验
 * （`Config["~standard"].validate`），普通空对象会因 `~standard` 为 undefined
 * 在启动时抛 "Cannot read properties of undefined (reading 'validate')"。
 * 不导出 Config 则 cordis 直接跳过校验（见 resolveConfig）。
 */
export const name = '@dsh-external/dsh-model-provider-headers'

export function apply(ctx: unknown): void {
  // 无 host 逻辑。功能与数据均在浏览器端经 Remote 通道完成。
  // 注意：不能访问 ctx.logger 等属性（没有声明 inject 的服务不能读 ctx 属性）。
  void ctx
}