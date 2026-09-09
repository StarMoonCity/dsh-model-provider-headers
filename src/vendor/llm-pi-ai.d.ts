/**
 * Vendored @deepseek-ai/dsh-llm-pi-ai adapter (BSD-3-Clause, DeepSeek Harness).
 *
 * 来源：node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js
 * 本地改动仅两处（见文件内 ▲/▼ 注释）：
 *  1. `name` 改为本插件包名（避免与官方 llm-pi-ai 实例重名）。
 *  2. `streamWithSnapshot` 的请求头组装处注入 `x-opencode-session: <sessionId>`。
 * 其余逻辑（profile 解析、settings section、catalog、replay、图片、重试）保持原样。
 *
 * 本声明文件仅用于让 host 入口的类型检查通过；实现由同目录 .js 提供，
 * 构建时复制到 lib/vendor/（tsc 不解析其内部）。
 */
export declare const name: string
export declare const inject: string[]
export declare const Config: unknown
export declare class PiAiAdapter {
  constructor(config: unknown)
}
export declare function apply(ctx: unknown, config: unknown): void
export declare function recordKeyFor(providerId: string): string
export declare function supportedProtocols(): string[]