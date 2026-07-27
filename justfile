# TjuaeUI 开发任务
# 用法：just <任务名>

# Windows 上无 shebang 的简单任务使用 PowerShell
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

# 默认任务：显示可用命令
default:
    @just --list --unsorted

# ============================================================
# 开发
# ============================================================

# 启动开发服务（Electron + Vite HMR）
dev:
    bun run start

# 启动 WebUI 开发模式
webui:
    bun run webui

# 启动允许远程访问的 WebUI
webui-remote:
    bun run webui:remote

# 启动 WebUI 生产模式
webui-prod:
    bun run webui:prod

# 启动 CLI 模式
cli:
    bun run cli

# ============================================================
# 环境检查（需要 pwsh）
# ============================================================

# 检查全部构建前置条件
[no-exit-message]
preflight:
    #!/usr/bin/env pwsh
    $ErrorActionPreference = 'Continue'
    $failed = $false
    Write-Host "=========================================="
    Write-Host "  TjuaeUI 构建前检查"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "[1/6] Node.js..."
    try {
        $nodeVer = (node --version 2>&1).Trim()
        $major = [int]($nodeVer -replace '^v','').Split('.')[0]
        if ($major -ge 22) { Write-Host "  通过  Node.js $nodeVer" }
        else { Write-Host "  警告  Node.js $nodeVer（建议 >= 22）" }
    } catch { Write-Host "  失败  未找到 Node.js"; $failed = $true }
    Write-Host "[2/6] bun..."
    try {
        $bunVer = (bun --version 2>&1).Trim()
        Write-Host "  通过  bun $bunVer"
    } catch { Write-Host "  失败  未找到 bun"; $failed = $true }
    Write-Host "[3/6] Python（用于原生模块）..."
    try {
        $pyVer = (python --version 2>&1).Trim()
        Write-Host "  通过  $pyVer"
    } catch { Write-Host "  警告  未找到 Python（编译原生模块时需要）" }
    Write-Host "[4/6] 依赖（node_modules）..."
    if ((Test-Path "node_modules") -and ((Test-Path "bun.lock") -or (Test-Path "package-lock.json"))) {
        Write-Host "  通过  node_modules 已存在"
    } else {
        Write-Host "  警告  缺少 node_modules，正在运行：just install"
        just install
        if (Test-Path "node_modules") { Write-Host "  通过  node_modules 已安装" }
        else { Write-Host "  失败  依赖安装失败"; $failed = $true }
    }
    Write-Host "[5/6] 原生模块（better-sqlite3）..."
    $nativeOk = (Test-Path "node_modules/better-sqlite3/build/Release/better_sqlite3.node") -or (Test-Path "node_modules/better-sqlite3/prebuilds")
    if ($nativeOk) { Write-Host "  通过  已找到 better-sqlite3 原生模块" }
    else { Write-Host "  警告  缺少 better-sqlite3 原生二进制，请运行：just rebuild-native" }
    Write-Host "[6/6] Electron 版本..."
    try {
        $electronVer = (node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')" 2>&1).Trim()
        Write-Host "  通过  Electron $electronVer"
    } catch { Write-Host "  失败  无法读取 Electron 版本"; $failed = $true }
    Write-Host ""
    Write-Host "=========================================="
    if ($failed) { Write-Host "  构建前检查失败"; exit 1 }
    else { Write-Host "  构建前检查通过" }
    Write-Host "=========================================="

# 显示当前构建环境
info:
    #!/usr/bin/env bash
    echo "TjuaeUI 构建环境"
    echo "========================"
    echo "Node:     $(node --version)"
    echo "bun:      $(bun --version)"
    electronVer=$(node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')")
    appVer=$(node -p "require('./package.json').version")
    echo "应用:     v$appVer"
    echo "Electron: $electronVer"
    echo "分支:     $(git branch --show-current)"
    echo "提交:     $(git rev-parse --short HEAD)"

# ============================================================
# 依赖与原生模块
# ============================================================

# 安装依赖
install:
    bun install

# 安装依赖并允许更新锁文件
install-update:
    bun install

# 完整初始化：安装依赖并重建原生模块
setup: install rebuild-native

# 为 Electron 重建原生模块（关键步骤）
# Windows 上请通过以下方式安装 MSVC 构建工具：
#   choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools"
# 或安装 Visual Studio 2022 的“使用 C++ 的桌面开发”工作负载。
[no-exit-message]
rebuild-native:
    #!/usr/bin/env pwsh
    $ErrorActionPreference = 'Stop'
    $electronVer = (node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')" 2>&1).Trim()
    $platform = (node -p "process.platform" 2>&1).Trim()
    $arch = (node -p "process.arch" 2>&1).Trim()
    Write-Host "=========================================="
    Write-Host "正在为 Electron $electronVer 重建原生模块"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "[步骤 1] 使用锁文件内工具重建..."
    node scripts/rebuildNativeModules.js --module better-sqlite3 --module-root node_modules/better-sqlite3 --platform $platform --arch $arch --electron-version $electronVer
    Write-Host "  通过  原生模块重建已完成"
    Write-Host ""
    Write-Host "[验证] 正在检查原生模块..."
    $verified = $true
    $sqliteNode = "node_modules/better-sqlite3/build/Release/better_sqlite3.node"
    if (Test-Path $sqliteNode) {
        $size = [math]::Round((Get-Item $sqliteNode).Length / 1MB, 1)
        Write-Host "  通过  better-sqlite3（$size MB）"
    } elseif (Test-Path "node_modules/better-sqlite3/prebuilds") {
        Write-Host "  通过  better-sqlite3（预构建）"
    } else {
        Write-Host "  失败  未找到 better-sqlite3 原生模块"
        $verified = $false
    }
    Write-Host ""
    if ($verified) {
        Write-Host "  所有原生模块验证通过"
    } else {
        Write-Host "  原生模块验证失败"
        exit 1
    }

# 验证 Node.js 能否实际加载原生模块
[no-exit-message]
verify-native:
    #!/usr/bin/env pwsh
    Write-Host "正在验证原生模块能否加载..."
    $result = node -e "try { require('better-sqlite3'); console.log('OK'); } catch(e) { console.log('FAIL: ' + e.message); process.exit(1); }" 2>&1
    if ($result -match "OK") {
        Write-Host "  通过  better-sqlite3 加载正常"
    } else {
        Write-Host "  失败  better-sqlite3：$result"
        Write-Host "  请运行：just rebuild-native"
        exit 1
    }
    Write-Host "所有原生模块均已验证且可以加载。"

# ============================================================
# 构建（与 CI 工作流环境一致）
# ============================================================

# 为当前平台构建（前置检查 → 构建）
build: preflight
    #!/usr/bin/env bash
    export NODE_OPTIONS="--max-old-space-size=8192"
    bun run build

# 快速构建：尽可能复用 Vite 缓存
build-quick: preflight
    #!/usr/bin/env bash
    export NODE_OPTIONS="--max-old-space-size=8192"
    node scripts/build-with-builder.js auto --skip-native

# 仅构建应用目录（不生成安装包），适合快速迭代
build-package: preflight
    #!/usr/bin/env bash
    export NODE_OPTIONS="--max-old-space-size=8192"
    node scripts/build-with-builder.js auto --pack-only --skip-native

# 强制完整重建（清理缓存）
build-force: preflight clean
    #!/usr/bin/env bash
    export NODE_OPTIONS="--max-old-space-size=8192"
    node scripts/build-with-builder.js auto --force

# 构建 Windows x64
build-win-x64: preflight
    #!/usr/bin/env pwsh
    Write-Host "正在确认 npm 依赖..."
    if (-not (Test-Path "node_modules")) { npm install } else { npm install --prefer-offline }
    $env:NODE_OPTIONS = "--max-old-space-size=8192"
    $env:npm_config_runtime = "electron"
    $env:npm_config_target = (node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')" 2>&1).Trim()
    $env:npm_config_arch = "x64"
    $env:npm_config_target_arch = "x64"
    $env:npm_config_disturl = "https://electronjs.org/headers"
    $env:npm_config_build_from_source = "true"
    $env:MSVS_VERSION = "2022"
    $env:GYP_MSVS_VERSION = "2022"
    node scripts/build-with-builder.js x64 --win --x64

# 构建 Windows arm64
build-win-arm64: preflight
    #!/usr/bin/env pwsh
    Write-Host "正在确认 npm 依赖..."
    if (-not (Test-Path "node_modules")) { npm install } else { npm install --prefer-offline }
    $env:NODE_OPTIONS = "--max-old-space-size=8192"
    $env:npm_config_runtime = "electron"
    $env:npm_config_target = (node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')" 2>&1).Trim()
    $env:npm_config_arch = "arm64"
    $env:npm_config_target_arch = "arm64"
    $env:npm_config_disturl = "https://electronjs.org/headers"
    $env:npm_config_build_from_source = "true"
    $env:MSVS_VERSION = "2022"
    $env:GYP_MSVS_VERSION = "2022"
    node scripts/build-with-builder.js arm64 --win --arm64

# 构建 Windows（自动检测架构）
build-win: preflight
    #!/usr/bin/env pwsh
    Write-Host "正在清理输出目录..."
    Get-Process -Name "TjuaeUI","electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path "out") { Remove-Item -Recurse -Force "out" -ErrorAction SilentlyContinue }
    npm install
    bun run postinstall
    if ($LASTEXITCODE -ne 0) { Write-Host "postinstall 失败，已停止构建"; exit $LASTEXITCODE }
    $env:NODE_OPTIONS = "--max-old-space-size=8192"
    $env:MSVS_VERSION = "2022"
    $env:GYP_MSVS_VERSION = "2022"
    bun run build-win

# 构建 macOS ARM64
build-mac-arm64: preflight
    #!/usr/bin/env bash
    echo "正在确认 npm 依赖..."
    [ -d "node_modules" ] && npm install --prefer-offline || npm install
    export NODE_OPTIONS="--max-old-space-size=8192"
    export npm_config_runtime="electron"
    export npm_config_target=$(node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')")
    export npm_config_disturl="https://electronjs.org/headers"
    node scripts/build-with-builder.js arm64 --mac --arm64

# 构建 macOS x64
build-mac-x64: preflight
    #!/usr/bin/env bash
    echo "正在确认 npm 依赖..."
    [ -d "node_modules" ] && npm install --prefer-offline || npm install
    export NODE_OPTIONS="--max-old-space-size=8192"
    export npm_config_runtime="electron"
    export npm_config_target=$(node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')")
    export npm_config_disturl="https://electronjs.org/headers"
    node scripts/build-with-builder.js x64 --mac --x64

# 构建 macOS（arm64 + x64）
build-mac: preflight
    #!/usr/bin/env bash
    echo "正在确认 npm 依赖..."
    [ -d "node_modules" ] && npm install --prefer-offline || npm install
    export NODE_OPTIONS="--max-old-space-size=8192"
    export npm_config_runtime="electron"
    export npm_config_target=$(node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')")
    export npm_config_disturl="https://electronjs.org/headers"
    bun run build-mac

# 构建 Linux
build-linux: preflight
    #!/usr/bin/env bash
    echo "正在确认 npm 依赖..."
    [ -d "node_modules" ] && npm install --prefer-offline || npm install
    export NODE_OPTIONS="--max-old-space-size=8192"
    export npm_config_runtime="electron"
    export npm_config_target=$(node -p "require('./package.json').devDependencies.electron.replace(/[\^~]/g, '')")
    export npm_config_disturl="https://electronjs.org/headers"
    bun run build-deb

# 仅构建 electron-vite 产物，不生成安装包
package:
    bun run package

# 生成发布产物（快捷任务）
dist:
    bun run dist

# ============================================================
# 代码质量
# ============================================================

# 运行代码检查
lint:
    bun run lint

# 运行代码检查并自动修复
lint-fix:
    bun run lint:fix

# 格式化代码
fmt:
    bun run format

# 检查格式
fmt-check:
    bun run format:check

# 类型检查
typecheck:
    bunx tsc --noEmit

# 生成并验证 i18n 类型
i18n-check:
    bun run i18n:types
    node scripts/check-i18n.js

# 检查仓库身份、去推广和黑盒依赖约束
identity-check:
    bun run identity:check

# 运行全部检查（身份 + lint + format + typecheck + i18n），与 CI 代码质量任务一致
check: identity-check lint fmt-check typecheck i18n-check

# 推送门禁：lint + 格式检查 + 类型检查 + i18n + 测试，通过后再推送
# 使用 --quiet 隐藏警告；出现错误时退出码仍为非零
push *ARGS: identity-check lint-strict fmt-check typecheck i18n-check test
    git push {{ ARGS }}

# 仅报告 lint 错误（用于 CI 和推送门禁）
lint-strict:
    bun run lint -- --quiet

# ============================================================
# 测试
# ============================================================

# 运行全部测试
test:
    bun run test

# 以监听模式运行测试
test-watch:
    bun run test:watch

# 运行测试并生成覆盖率
test-coverage:
    bun run test:coverage

# 运行契约测试
test-contract:
    bun run test:contract

# 运行集成测试
test-integration:
    bun run test:integration

# 验证打包产物包含完整渲染资源（i18n 安全检查）
test-packaged-i18n:
    bun run test:packaged:i18n

# 运行 E2E 测试（Playwright + Electron，会自动启动应用）
# 先把主进程、预加载脚本和渲染进程构建到 out/，确保产物为最新版本。
e2e-test:
    bun run package
    bunx playwright test --config playwright.config.ts

# 仅运行扩展相关 E2E，缩短迭代时间
e2e-test-ext:
    bun run package
    bunx playwright test --config playwright.config.ts tests/e2e/specs/ext-*.e2e.ts

# 以可见窗口运行 E2E，便于调试
e2e-test-headed:
    bun run package
    bunx playwright test --config playwright.config.ts --headed

# 打开 Playwright HTML 报告
e2e-report:
    bunx playwright show-report tests/e2e/report

# ============================================================
# 扩展系统（RFC-001）
# ============================================================

# 启动开发服务并加载示例扩展
# 开发模式默认在 9222 端口启用 CDP 远程调试
dev-ext:
    node scripts/dev-bootstrap.mjs launch start --extensions

# 启动 WebUI 并加载示例扩展
webui-ext:
    node scripts/dev-bootstrap.mjs launch webui --extensions

# 启动 CLI 并加载示例扩展
cli-ext:
    node scripts/dev-bootstrap.mjs launch cli --extensions

# 跨平台诊断开发环境扩展启动问题
dev-ext-doctor:
    node scripts/dev-bootstrap.mjs doctor

# 启动已打包但未压缩的应用并加载示例扩展，用于一键调试
# 需要 out/*-unpacked 产物
packaged-ext:
    node scripts/packaged-launch.mjs

# 先构建应用目录，再加载示例扩展启动
packaged-ext-build: build-package
    node scripts/packaged-launch.mjs

# 验证扩展系统类型能够正确编译
ext-typecheck:
    bunx tsc --noEmit --project tsconfig.json

# 运行扩展系统测试
ext-test:
    bunx vitest run tests/extensions/ --passWithNoTests

# 以监听模式运行扩展系统测试
ext-test-watch:
    bunx vitest tests/extensions/

# ============================================================
# 实用工具
# ============================================================

# 重置 WebUI 密码
reset-password:
    bun run resetpass

# 清理构建产物
clean:
    #!/usr/bin/env bash
    rm -rf out dist
    echo "构建产物已清理。"

# 深度清理（构建产物 + node_modules）
clean-all: clean
    #!/usr/bin/env bash
    if [ -d "node_modules" ]; then
        echo "正在删除 node_modules..."
        rm -rf node_modules
    fi
    echo "深度清理完成。请运行：just setup"

# 列出构建产物
list-artifacts:
    #!/usr/bin/env bash
    if [ -d "out" ]; then
        find out -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.zip" \) -exec ls -lh {} \; | awk '{print "  " $NF "  (" $5 ")"}'
    else
        echo "未找到构建产物。请运行：just build"
    fi

# 类 CI 的完整构建验证（与 GitHub Actions 工作流一致）
ci-local: check test build
    @echo "本地 CI 流程通过！"
