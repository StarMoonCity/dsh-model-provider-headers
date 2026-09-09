/**
 * dsh-model-provider-headers — Host half.
 *
 * 两件事：
 *  1. 接管 `llm-pi-ai` 命名空间下的所有 pi-ai provider 路由（vendored 官方适配器，
 *     本地仅改两处：插件名、请求头注入），把当前会话的稳定 ID 作为
 *     `x-opencode-session` 请求头发给网关，供路由与提示词缓存优化。
 *  2. 通过官方 settings section 继续承载 `llm-pi-ai` 设置（供应商档案、请求头），
 *     设置页与 `settings.yaml` 行为与官方一致。
 *
 * 装配要求：官方 `@deepseek-ai/dsh-llm-pi-ai` 必须禁用（同一 provider 只能注册
 * 一个 LlmAdapter，否则抛 DUPLICATE_ADAPTER）。见包内 cordis.patch.yml 说明。
 *
 * Client half 仍在 src/client/index.ts：为每个 pi-ai 供应商卡片提供请求头编辑 UI。
 */
export { Config, PiAiAdapter, apply, inject, name, recordKeyFor, supportedProtocols } from './vendor/llm-pi-ai.js'