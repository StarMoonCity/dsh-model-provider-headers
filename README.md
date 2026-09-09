# dsh-model-provider-headers

为 DSH 的 pi-ai 模型供应商提供两类请求头能力：

1. **静态请求头**：在「设置 → 模型」的每个 pi-ai 供应商卡片上可视化编辑 `headers`（写入 `~/.dsh/settings.yaml`，即改即生效）。
2. **动态会话 ID**：把**每段对话的稳定会话 ID** 作为 `x-opencode-session` 请求头发给供应商网关，供其做路由与提示词缓存优化。

## 一、动态会话 ID（x-opencode-session）

### 效果

DSH 的 agent loop 每次请求都会把当前会话 ID 烙进 `GenerateOptions.sessionId`（`this.session.id`，形如 `session-99c2275f-…`）。本插件在**出站 HTTP 请求**上把它写成请求头：

```
POST /v1/chat/completions
x-opencode-session: session-99c2275f-ae2f-4d03-91b5-401c4e05fdba
```

同一段对话的所有请求带**同一个稳定 ID**；不同对话（含 subagent 的子会话）各自不同。手建的一次性调用（无 `sessionId`）不注入该头。

### 装配要求（重要）

本插件**接管** `llm-pi-ai` 命名空间下的全部 pi-ai 供应商路由（vendored 官方适配器 + 一处改动）。因此**必须先禁用官方 `@deepseek-ai/dsh-llm-pi-ai`**——同一 provider 只能注册一个 LlmAdapter，两者同时注册会抛 `DUPLICATE_ADAPTER` 导致启动失败。

包内 `cordis.patch.yml` 已包含该禁用条目，`dsh plugin add` + 重启后自动生效（组合树里会显示 `- id: llm-pi-ai` `disabled: true`，标注 `patched by @dsh-external/dsh-model-provider-headers`）。

设置数据不受影响：命名空间仍是 `llm-pi-ai`，`settings.yaml` 既有配置与设置页行为完全一致。

### 回滚

若需恢复官方适配器：

```bash
# 1. 从 profile 移除本插件（同时移除其 bundle 层 patch）
dsh plugin --profile web remove @dsh-external/dsh-model-provider-headers
# 2. 重启 DSH
```

### 验证请求头确实发出

用一个只记录请求头的本地服务器 + 临时把某供应商的 `baseURL` 指向它即可：

```bash
# 1. 起抓包服务器（记录到 /tmp/dsh-header-capture.log）
node scripts/capture-headers.mjs 8399 /tmp/dsh-header-capture.log

# 2. 在 settings.yaml 给一个 pi-ai 供应商临时加 baseURL
#    llm-pi-ai:
#      providers:
#        opencode-go:
#          baseURL: http://127.0.0.1:8399/v1

# 3. 触发一次该供应商的请求（headless 或 UI 里发消息）
dsh --profile headless "只回复 OK"

# 4. 看抓到的头
grep x-opencode-session /tmp/dsh-header-capture.log
#   → x-opencode-session: session-cf5e78ec-e8fb-43eb-8a3a-a77f0abc0a3f

# 5. 恢复 settings.yaml（删掉临时 baseURL）
```

同一会话的多次请求（含重试）应带**同一个** `session-<uuid>`；不同对话各自不同。

## 二、静态请求头编辑

在「设置 → 模型」里展开任意 pi-ai 供应商卡片（如 `cli-pxy`、`minimax-cn`、`opencode-go`），卡片内会出现「自定义请求头 (Headers)」编辑区：

- 点 **+ 添加行** 填 `Header 名` 和 `值`，点 **保存**
- 保存后写入 `~/.dsh/settings.yaml` 的 `llm-pi-ai.providers.<route>.headers`，下一次请求即带上这些头
- 支持添加/删除多行；删除全部则移除该 `headers` 字段
- 内置校验：非法 HTTP 头名/值（与 Fetch `Headers` 同源）或重复（大小写不敏感）的头名会被拒绝
- 只读环境（`writable: false`）自动禁用编辑

> 动态的 `x-opencode-session` 与这里手填的静态头共存；若静态头里也填了同名项，**动态值优先**（注入发生在静态头合并之后）。

## 安装

### 方式一：GitHub Release（推荐）

从本仓库的 [Releases](https://github.com/StarMoonCity/dsh-model-provider-headers/releases) 下载最新的 `dsh-external-dsh-model-provider-headers-<version>.tgz`，然后：

```bash
dsh plugin --profile web add dsh-external-dsh-model-provider-headers-0.1.0.tgz
# 重启 DSH 生效
```

### 方式二：从源码构建

```bash
git clone https://github.com/StarMoonCity/dsh-model-provider-headers.git
cd dsh-model-provider-headers
pnpm install
DSH_CHECKOUT=<dsh 安装目录> bash scripts/build.sh   # 编译 host + 复制 vendored 适配器
pnpm run build:client                               # tsdown 打包浏览器端 → lib/client.js
npm pack                                            # 产出 tgz
```

## 工作原理（给插件开发者）

### 动态会话 ID 为什么必须接管适配器

DSH 里给请求加头的"缝"只有一处：**适配器构建出站请求时**。其余路径都走不通：

| 缝 | 能力 | 结论 |
|---|---|---|
| `llm/stream` waterfall | 请求深冻结、只读（"listeners read it, never rewrite it"） | ❌ 不能改请求头 |
| `profile.headers`（settings） | 静态 `Record<string,string>`，供应商级共享 | ❌ 做不到每会话 |
| `attributionHeaders()` | 固定函数，不可扩展 | ❌ |
| `ctx.llm.registerAdapter(providers, adapter)` | 自定义适配器 | ✅ 唯一正路 |

所以本插件 vendor 官方 `@deepseek-ai/dsh-llm-pi-ai` 的适配器源码（BSD-3-Clause），只改两处：

1. `const name` → 本插件包名（避免与官方实例重名）
2. `streamWithSnapshot` 的 `headers:` 组装处注入 `x-opencode-session`

```js
headers: {
  ...requestHeaders(profile.headers),
  ...options.sessionId === void 0 ? {} : { "x-opencode-session": String(options.sessionId) }
}
```

其余全部保持官方行为：profile 解析与校验、settings section、pi-ai catalog、replay、图片管线、推理预算、重试、模型发现。

### 静态请求头 UI

- **Client half**：UI 注册在 `settings.models.provider-card` 槽（keyed 槽，entryKey = `settingsNs`，pi-ai 供应商是 `llm-pi-ai`）。
- **读**：`ctx.remote.settings.describe()` → `{ok, value:{namespaces:[{ns, value, revision}]}}`（Typert 包装，数据在 `value` 里）。
- **写**：`ctx.remote.settings.mutate('llm-pi-ai', ops, revision)`，返回同样包装 `{ok, value:{revision}}`，冲突时 `error.code === 'settings/conflict'`。
- **inject 必须写全**：`['slots','remote','remote.settings']`——只写 `remote.settings` 会在读 `ctx.remote` 时抛 `cannot get property "remote" without inject`。
- **跨 realm 注意**：ops 必须由浏览器端构造、经 Remote 通道传输（Typert 在宿主 realm 解码）；动态插件 host 沙箱里的对象过不了 settings 服务的严格 `isPlainObject` 校验。

## 许可

BSD-3-Clause。`src/vendor/llm-pi-ai.js` 源自 DeepSeek Harness 的 `@deepseek-ai/dsh-llm-pi-ai`（BSD-3-Clause），仅作上述两处修改。
