#!/bin/bash
# dsh-model-provider-headers — build (client-only plugin).
# Resolve the DSH install's node_modules for type deps (cordis, react, etc.),
# link them locally, typecheck with the global tsc, then let tsdown bundle the
# browser half (run via `npm run build:client`).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# DSH_CHECKOUT 探测：env → 常见路径（~/.dsh/dsh-harness 由 dev_build_plugin 注入）→ 安装根
CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ] || [ ! -d "$CHECKOUT/node_modules" ]; then
  for candidate in "$HOME/.dsh/dsh-harness" "$HOME/dsh-harness" "$HOME/dsh"; do
    if [ -d "$candidate/node_modules" ]; then CHECKOUT="$candidate"; break; fi
  done
fi
if [ -z "$CHECKOUT" ] || [ ! -d "$CHECKOUT/node_modules" ]; then
  echo "build: cannot locate the dsh install node_modules (set DSH_CHECKOUT)" >&2
  exit 1
fi

NM="$CHECKOUT/node_modules"

link_pkg() {
  local target="$NM/$2"
  if [ ! -e "$target" ]; then
    echo "build: dependency target missing: $target" >&2
    exit 1
  fi
  node -e "
    const fs = require('fs');
    const path = require('path');
    const link = path.resolve(process.argv[1]);
    const target = path.resolve(process.argv[2]);
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  " "node_modules/$1" "$target"
}

echo "=== Linking build type deps (install: $CHECKOUT) ==="
mkdir -p node_modules/@deepseek-ai
link_pkg @deepseek-ai/cordis @deepseek-ai/cordis
link_pkg @deepseek-ai/schemastery @deepseek-ai/schemastery
link_pkg @deepseek-ai/cosmokit @deepseek-ai/cosmokit
link_pkg @deepseek-ai/dsh-tools @deepseek-ai/dsh-tools
link_pkg @deepseek-ai/dsh-llm @deepseek-ai/dsh-llm
link_pkg @types/node @types/node
# react 类型（客户端编译用；tsdown 会把 react 保持 external）
if [ -d "$NM/@types/react" ]; then
  link_pkg @types/react @types/react
fi

TSC="$(command -v tsc || true)"
if [ -z "$TSC" ]; then TSC="$NM/.bin/tsc"; fi
if [ ! -e "$TSC" ] && [ ! -e "$TSC.cmd" ]; then
  echo "build: tsc not found (need typescript on PATH or in the install)" >&2
  exit 1
fi

echo "=== Compiling host src → lib (tsc $("$TSC" --version)) ==="
"$TSC" -p tsconfig.json
echo "=== Host build complete (client bundle is produced by tsdown via build:client) ==="