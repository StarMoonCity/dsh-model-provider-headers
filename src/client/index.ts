/**
 * dsh-model-provider-headers — Client half.
 *
 * 为 DSH「设置 → 模型」页面里每个 pi-ai 自定义/自建模型供应商卡片提供一个
 * 「自定义请求头 (Headers)」编辑器。写入走官方同款 Remote 通道
 * (`ctx.remote.settings.mutate`)，落盘到 `llm-pi-ai.providers.<route>.headers`，
 * 即改即生效、无需重启。
 *
 * 关键点（2026 实测）：
 *  - 目标槽位 `settings.models.provider-card` 是 keyed 槽，entryKey = settingsNs；
 *    pi-ai 供应商的 settingsNs 是 `llm-pi-ai`，所以注册 key 用 `llm-pi-ai`。
 *  - 读：`ctx.remote.settings.describe()` → namespaces 里找 `llm-pi-ai` view，
 *    取 `value.providers[route].headers` 与 `revision`。
 *  - 写：`ctx.remote.settings.mutate('llm-pi-ai', ops, revision)`（官方 models 页同款。
 *    ops 经 Typert 在宿主 realm 解码，规避动态插件 sandbox 的跨 realm 校验问题。）
 *  - `inject` 必须声明 `slots`、`remote` 与 `remote.settings`（官方 ui-settings-models
 *    同款：`remote` 是访问 `ctx.remote` 的前置声明，只写 `remote.settings` 会在
 *    读取 `ctx.remote` 时抛 "cannot get property remote without inject"）。
 */
import React from 'react'

/** 供应商目录行（settings.models.provider-card 的 ownerProps.provider）。 */
interface ProviderDirectoryEntry {
  provider: string
  displayName?: string
  settingsNs?: string
  settingsPath?: string[]
  apiKeyEnv?: string
  active?: boolean
}

/** remote.settings 的最小形状（与 dsh-api-settings-controller 的 Remote 面一致）。 */
interface SettingsRemote {
  describe(): Promise<{
    writable: boolean
    hasDocument: boolean
    namespaces: Array<{ ns: string; value: unknown; revision: number }>
  }>
  mutate(ns: string, ops: Array<Record<string, unknown>>, expectedRevision?: number): Promise<{
    ns: string
    revision: number
    value: unknown
  }>
}

/** 槽位注册所需的最小服务面。 */
interface ClientContext {
  slots: {
    inject(key: string, callback: () => unknown): () => void
    register(spec: { name: string; key: string }, component: (props: unknown) => React.ReactElement): unknown
  }
  /** 由插件根上下文注入面提供（inject 声明后可用）。 */
  remote?: {
    settings: SettingsRemote
  }
  effect(callback: () => (() => void) | void, label?: string): void
}

export const inject = ['slots', 'remote', 'remote.settings']

const NS = 'llm-pi-ai'
const TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

const css = `
.hdrs-box{border:0.5px solid var(--dsw-alias-border-l3,#444);border-radius:10px;padding:8px 10px;margin-top:10px;display:flex;flex-direction:column;gap:8px;font-size:12px}
.hdrs-row{display:flex;gap:6px;align-items:center}
.hdrs-row input{flex:1;background:transparent;border:0.5px solid var(--dsw-alias-border-l3,#555);border-radius:6px;color:var(--dsw-alias-label-primary,inherit);padding:4px 6px;font-size:12px}
.hdrs-row .hdrs-key{flex:0 0 40%}
.hdrs-del{flex:none;cursor:pointer;border:none;background:transparent;color:var(--dsw-alias-state-error-primary,#f66);font-size:14px}
.hdrs-add{cursor:pointer;align-self:flex-start;border:0.5px solid var(--dsw-alias-border-l3,#555);background:transparent;color:var(--dsw-alias-label-secondary,inherit);border-radius:6px;padding:3px 8px;font-size:12px}
.hdrs-save{cursor:pointer;align-self:flex-start;border:none;border-radius:14px;background:var(--dsw-alias-button-primary-fill,#3b82f6);color:var(--dsw-alias-label-primary-foreground,#fff);padding:4px 12px;font-size:12px}
.hdrs-status{color:var(--dsw-alias-state-success-primary,#4ade80);font-size:12px}
.hdrs-err{color:var(--dsw-alias-state-error-primary,#f66);font-size:12px}
`

interface Row {
  k: string
  v: string
}

/** apply() 注入的 settings remote，供组件闭包直达（组件由槽系统渲染，拿不到 ctx）。 */
let settingsRemote: SettingsRemote | undefined

function ProviderHeadersCard(props: { provider: ProviderDirectoryEntry }): React.ReactElement {
  const route = props.provider.provider
  const [rows, setRows] = React.useState<Row[]>([])
  const [status, setStatus] = React.useState('')
  const [err, setErr] = React.useState('')
  const [revision, setRevision] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    let alive = true
    if (!settingsRemote) return
    settingsRemote.describe().then((res) => {
      if (!alive) return
      const view = res.namespaces.find((n) => n.ns === NS)
      if (view) setRevision(view.revision)
      const value = view?.value as { providers?: Record<string, { headers?: Record<string, string> }> } | undefined
      const h = value?.providers?.[route]?.headers ?? {}
      const list = Object.keys(h).map((k) => ({ k, v: String(h[k]) }))
      setRows(list.length ? list : [{ k: '', v: '' }])
    }).catch((e: unknown) => { if (alive) setErr(String((e as Error)?.message ?? e)) })
    return () => { alive = false }
  }, [route])

  const update = (i: number, field: 'k' | 'v', value: string): void => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }
  const del = (i: number): void => setRows((rs) => rs.filter((_, idx) => idx !== i))
  const add = (): void => setRows((rs) => [...rs, { k: '', v: '' }])

  const save = (): void => {
    setErr('')
    setStatus('')
    if (!settingsRemote) { setErr('settings remote 不可用'); return }
    const headers: Record<string, string> = {}
    let invalid = false
    for (const r of rows) {
      const k = r.k.trim()
      if (!k) continue
      const v = r.v
      if (!TOKEN_RE.test(k) || /[\r\n]/.test(v)) { invalid = true; break }
      headers[k] = v
    }
    if (invalid) { setErr('包含非法的 HTTP 头名或含换行的值'); return }

    const keys = Object.keys(headers)
    const ops = keys.length === 0
      ? [{ op: 'unset', path: ['providers', route, 'headers'] }]
      : [{ op: 'set', path: ['providers', route, 'headers'], value: headers }]

    settingsRemote.mutate(NS, ops, revision).then((res) => {
      setRevision(res.revision)
      setRows(keys.length ? Object.keys(headers).map((k) => ({ k, v: String(headers[k]) })) : [{ k: '', v: '' }])
      setStatus('已保存')
    }).catch((e: unknown) => setErr(String((e as Error)?.message ?? e)))
  }

  return React.createElement('div', { className: 'hdrs-box' },
    React.createElement('div', { style: { fontWeight: 500 } }, '自定义请求头 (Headers)'),
    rows.map((r, i) => React.createElement('div', { className: 'hdrs-row', key: i },
      React.createElement('input', { className: 'hdrs-key', placeholder: 'Header 名', value: r.k, onChange: (e) => update(i, 'k', e.target.value) }),
      React.createElement('input', { placeholder: '值', value: r.v, onChange: (e) => update(i, 'v', e.target.value) }),
      React.createElement('button', { className: 'hdrs-del', onClick: () => del(i), title: '删除' }, '✕')
    )),
    status ? React.createElement('div', { className: 'hdrs-status' }, status) : null,
    err ? React.createElement('div', { className: 'hdrs-err' }, err) : null,
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      React.createElement('button', { className: 'hdrs-add', onClick: add }, '+ 添加行'),
      React.createElement('button', { className: 'hdrs-save', onClick: save }, '保存')
    )
  )
}

export function apply(ctx: ClientContext): void {
  const remote = ctx.remote
  if (remote === undefined) return
  settingsRemote = remote.settings

  ctx.effect(() => {
    const styleEl = document.createElement('style')
    styleEl.textContent = css
    document.head.appendChild(styleEl)
    const dispose = ctx.slots.inject('settings.models.provider-card', () =>
      ctx.slots.register({ name: 'settings.models.provider-card', key: NS }, (props: unknown) =>
        React.createElement(ProviderHeadersCard, props as { provider: ProviderDirectoryEntry })
      ),
    )
    return () => {
      if (dispose) dispose()
      styleEl.remove()
      settingsRemote = undefined
    }
  }, 'dsh-model-provider-headers: provider-card')
}