# dsh-model-provider-headers

为 DSH 的「设置 → 模型」页面给**每个 pi-ai 自定义/自建模型供应商**（OpenAI 兼容网关、私有端点、自部署服务等）卡片提供一份**自定义请求头 (Headers) 编辑器**。

写入的目标字段是 `llm-pi-ai.providers.<route>.headers`——这是 `llm-pi-ai` 适配器本来就认可、会合并进每次出站 HTTP 请求的字段，只是官方设置页没有编辑入口。本插件补上这个入口，**即改即生效，无需重启 DSH**。

> 说明：官方 `deepseek-official` 适配器把请求头写死、没有 header 缝，本插件覆盖的是**自定义/自建供应商**这一类（即你在「设置 → 模型」里自己加的供应商，它们的 settingsNs 是 `llm-pi-ai`）。

## 效果

在「设置 → 模型」里展开任意 pi-ai 供应商卡片（如 `cli-pxy`、`minimax-cn`、`opencode-go`），卡片内会出现「自定义请求头 (Headers)」编辑区：

- 点 **+ 添加行** 填 `Header 名` 和 `值`，点 **保存**
- 保存后写入 `~/.dsh/settings.yaml` 的 `llm-pi-ai.providers.<route>.headers`，下一次请求即带上这些头
- 支持添加/删除多行；删除全部则移除该 `headers` 字段
- 内置校验：非法 HTTP 头名或含换行的值会被拒绝

## 安装

### 方式一：GitHub Release（推荐，别人也这样装）

从本仓库的 [Releases](https://github.com/StarMoonCity/dsh-model-provider-headers/releases) 下载最新的 `dsh-model-provider-headers-<version>.tgz`，然后：

```bash
# dsh 插件装配（重启后仍在）
dsh plugin --profile web add dsh-model-provider-headers-0.0.1.tgz
```

或者使用 dsh-super-injector 运行时注入（免重启、便于热重载调试）：

```text
dev_inject_plugin { "dir": "/path/to/dsh-model-provider-headers" }
```

### 方式二：从源码构建

```bash
git clone https://github.com/StarMoonCity/dsh-model-provider-headers.git
cd dsh-model-provider-headers
pnpm install
DSH_CHECKOUT=<dsh 安装/源码目录> bash scripts/build.sh      # 类型检查
pnpm run build:client                                       # tsdown 打包浏览器端 → lib/client.js
npm pack                                                    # 产出 tgz
```

## 工作原理（给插件开发者）

- **Client half only**：本插件不需要 Host 代码。UI 注册在 `settings.models.provider-card` 槽（keyed 槽，entryKey = `settingsNs`，pi-ai 供应商的 `settingsNs` 是 `llm-pi-ai`）。
- **读**：`ctx.remote.settings.describe()` → 找到 `llm-pi-ai` 命名空间视图 → 读 `value.providers[route].headers` 与 `revision`。
- **写**：`ctx.remote.settings.mutate('llm-pi-ai', ops, revision)` —— 与官方 `ui-settings-models` 页面完全同款通道。
- **跨 realm 注意**：写操作必须由**浏览器端构造 ops 数组**、经 Remote 通道传输（Typert 在宿主 realm 解码）。不要在动态插件 host 沙箱里手工构造 ops 传给宿主 `settings.mutate`——node:vm 沙箱对象过不了 settings 服务的严格 `isPlainObject` 校验（`Object.getPrototypeOf(v) === Object.prototype`）。

## 许可

BSD-3-Clause