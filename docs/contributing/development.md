# 开发指南

## 前置条件

- **Node.js** 22 或更高版本
- **Bun**：包管理器与运行时（[安装说明](https://bun.sh)）
- **Rust stable 与 Cargo**：构建本地 TjuaeCore 后端（[安装说明](https://rustup.rs)）
- **Python** 3.11+：编译原生模块
- **prek**：PR 代码检查器（`npm install -g @j178/prek`）

Windows 需要安装 Rust MSVC toolchain。如果 Rust 因缺少原生构建工具而编译失败，请通过 Visual Studio Installer 安装 **Microsoft C++ Build Tools**，然后重新打开终端。

## 仓库布局

TjuaeUI 开发至少涉及两个并列仓库：

- **TjuaeCore**（`https://github.com/liangboqiang/TjuaeCore.git`）构建本地后端可执行文件：macOS/Linux 为 `tjuaecore`，Windows 为 `tjuaecore.exe`
- **TjuaeUI**（`https://github.com/liangboqiang/TjuaeUI.git`）启动 Electron 桌面应用，并自动创建后端子进程

建议将仓库放在同一父目录：

```text
workspace/
├── TjuaeCore/
└── TjuaeUI/
```

桌面开发服务从 `bun run start` 继承的 `PATH` 中解析后端。应先安装 TjuaeCore，在同一个终端确认可执行文件可被发现，再启动 TjuaeUI。

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/liangboqiang/TjuaeCore.git
git clone https://github.com/liangboqiang/TjuaeUI.git
```

除非维护者要求测试其他分支，否则两个仓库都使用 `main`。

### 2. 构建并安装 TjuaeCore

在 TjuaeCore 仓库中运行。

#### macOS / Linux

```bash
cd TjuaeCore
cargo clean
cargo install --path crates/tjuaeui-app --locked

# 必要时让当前 shell 能找到 Cargo 安装的可执行文件
export PATH="$HOME/.cargo/bin:$PATH"

# 确认 TjuaeUI 可以找到后端
which tjuaecore
tjuaecore --help
```

如果 `which tjuaecore` 没有输出，请将 `export PATH="$HOME/.cargo/bin:$PATH"` 加入 shell 配置（`~/.zshrc`、`~/.bashrc` 或对应文件），重新打开终端后再验证。

#### Windows PowerShell

```powershell
cd TjuaeCore
cargo clean
cargo install --path crates/tjuaeui-app --locked

# 必要时让当前 PowerShell 会话能找到 Cargo 安装的可执行文件
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# 确认 TjuaeUI 可以找到后端
where.exe tjuaecore
tjuaecore --help
```

如果 `where.exe tjuaecore` 没有输出，请确认 `%USERPROFILE%\.cargo\bin` 已加入用户 `Path`，重新打开 PowerShell 后再验证。

### 3. 启动 TjuaeUI

在能够找到 `tjuaecore` 的终端中进入 TjuaeUI 仓库：

```bash
cd TjuaeUI

# 安装依赖
bun install

# 以开发模式启动 Electron 桌面应用
bun run start
```

启动期间，TjuaeUI 会自动创建 `tjuaecore` 子进程，并将后端端口传给渲染进程；无需在另一个终端手动启动 TjuaeCore。

## 更新本地后端

拉取或修改 TjuaeCore 后，重新安装后端可执行文件并重启 TjuaeUI：

```bash
cd ../TjuaeCore
cargo install --path crates/tjuaeui-app --locked --force

cd ../TjuaeUI
bun run start
```

在包版本未变时重建本地修改，需要使用 `--force`；否则 Cargo 可能保留已安装的旧文件。

## 后端启动故障排查

### `Cannot find "tjuaecore" binary`

TjuaeUI 无法从 `bun run start` 继承的 `PATH` 中找到后端。

请在启动 TjuaeUI 的同一终端检查：

```bash
# macOS / Linux
which tjuaecore

# Windows PowerShell
where.exe tjuaecore
```

命令失败时，将 Cargo 的可执行文件目录加入 `PATH`，再从新终端启动 TjuaeUI。

### 终端能运行 `tjuaecore`，但 TjuaeUI 仍找不到

确保在能够执行 `tjuaecore --help` 的**同一终端环境**中运行 `bun run start`。IDE 终端或从 GUI 启动的 shell 可能继承不同的 `PATH`；更新 `PATH` 后应重启 IDE，或从终端启动 IDE。

### 后端修改没有生效

退出 TjuaeUI，执行 `cargo install --path crates/tjuaeui-app --locked --force` 重新安装 TjuaeCore，再启动 TjuaeUI。开发期间 Electron 应用持有后端子进程，运行中的实例不会自动切换到刚安装的新文件。

### Windows Rust 构建错误

使用 Rust MSVC toolchain 并安装 Microsoft C++ Build Tools。安装或切换 toolchain 后，重新打开 PowerShell 再执行 TjuaeCore 安装命令。

## 脚本参考

### 开发

| 命令                        | 说明                                                              |
| --------------------------- | ----------------------------------------------------------------- |
| `bun start`                 | 以开发模式启动 Electron 桌面应用                                  |
| `bun run start:multi`       | 在已有实例旁启动第二个 Electron 实例，见[多实例开发](#多实例开发) |
| `bun run cli`               | `bun start` 的别名                                                |
| `bun run webui`             | 启动 WebUI 模式，不创建 Electron 窗口                             |
| `bun run webui:remote`      | 以允许远程访问的方式启动 WebUI                                    |
| `bun run webui:prod`        | 以生产模式启动 WebUI                                              |
| `bun run webui:prod:remote` | 以生产模式启动 WebUI 并允许远程访问                               |
| `bun run resetpass`         | 通过 CLI 重置用户密码                                             |

### 构建与分发

| 命令                      | 说明                                      |
| ------------------------- | ----------------------------------------- |
| `bun run package`         | 构建主进程、preload 和 renderer 到 `out/` |
| `bun run make`            | `bun run package` 的别名                  |
| `bun run dist`            | 构建当前平台的可分发安装包                |
| `bun run dist:mac`        | 构建 macOS 安装包                         |
| `bun run dist:win`        | 构建 Windows 安装包                       |
| `bun run dist:linux`      | 构建 Linux 安装包                         |
| `bun run build-mac`       | 同时构建 macOS arm64 与 x64 安装包        |
| `bun run build-mac:arm64` | 只构建 Apple Silicon 安装包               |
| `bun run build-mac:x64`   | 只构建 Intel macOS 安装包                 |
| `bun run build-win`       | 构建 Windows 安装包                       |
| `bun run build-win:arm64` | 构建 Windows ARM64 安装包                 |
| `bun run build-win:x64`   | 构建 Windows x64 安装包                   |
| `bun run build-deb`       | 构建 Linux `.deb` 安装包                  |
| `bun run build`           | `bun run build-mac` 的别名                |

### 独立服务器（非 Electron）

| 命令                               | 说明                              |
| ---------------------------------- | --------------------------------- |
| `bun run build:renderer:web`       | 构建用于独立 Web 部署的 renderer  |
| `bun run build:server`             | 将独立服务器打包到 `dist-server/` |
| `bun run server:start`             | 以开发模式运行独立服务器          |
| `bun run server:start:remote`      | 运行独立服务器并允许远程访问      |
| `bun run server:start:prod`        | 以生产模式运行独立服务器          |
| `bun run server:start:prod:remote` | 以生产模式运行并允许远程访问      |
| `bun run server:resetpass`         | 通过独立服务器 CLI 重置密码       |
| `bun run server:resetpass:prod`    | 在生产模式下重置密码              |

### 代码质量

| 命令                   | 说明                           |
| ---------------------- | ------------------------------ |
| `bun run lint`         | 只读检查 lint（oxlint）        |
| `bun run lint:fix`     | 自动修复 lint 问题             |
| `bun run format`       | 自动格式化代码（oxfmt）        |
| `bun run format:check` | 只检查格式，不修改文件         |
| `bun run i18n:types`   | 为 i18n 键生成 TypeScript 类型 |

### 测试

| 命令                         | 说明                         |
| ---------------------------- | ---------------------------- |
| `bun run test`               | 运行全部单元测试（Vitest）   |
| `bun run test:watch`         | 以 watch 模式运行测试        |
| `bun run test:coverage`      | 运行测试并生成覆盖率报告     |
| `bun run test:contract`      | 运行契约测试                 |
| `bun run test:integration`   | 运行集成测试                 |
| `bun run test:bun`           | 运行 Bun 专用数据库驱动测试  |
| `bun run test:e2e`           | 运行 Playwright 端到端测试   |
| `bun run test:packaged:i18n` | 对打包产物运行 i18n 集成测试 |

### 调试

| 命令                         | 说明                       |
| ---------------------------- | -------------------------- |
| `bun run debug:perf`         | 启用性能监控并启动应用     |
| `bun run debug:perf:report`  | 根据已收集数据生成性能报告 |
| `bun run debug:mcp`          | 调试 MCP server 连接       |
| `bun run debug:mcp:list`     | 列出已配置的 MCP server    |
| `bun run debug:mcp:validate` | 校验 MCP server 配置       |
| `bun run debug:custom-agent` | 调试自定义智能体连接       |

## 多实例开发

如果存在两个仓库副本（例如 `TjuaeUI` 与 `TjuaeUI-refactor`）且需要同时运行，可在第二个副本中执行：

```bash
bun run start:multi
```

该命令设置 `TJUAEUI_MULTI_INSTANCE=1`，从而：

- 跳过 Electron 单实例锁
- 使用独立的 userData 目录 `TjuaeUI-Dev-2`，避免数据库和配置冲突
- 隔离数据/配置符号链接路径（`~/.tjuaeui-dev-2`、`~/.tjuaeui-config-dev-2`）
- 自动递增 Vite renderer、CDP 与 WebUI proxy 端口，避免冲突

> **注意：**多实例 WebUI 默认使用 25810，而不是 25809。浏览第二个实例时应使用**无痕/隐私窗口**；两个实例共享 `localhost` cookie jar，但 JWT secret 不同，在同一浏览器会话中会导致认证失败。

## 代码检查（prek）

项目使用 [prek](https://github.com/j178/prek)（pre-commit 的 Rust 实现）执行代码检查，配置位于 `.pre-commit-config.yaml`：

```bash
# 安装 prek
npm install -g @j178/prek

# 安装 git hooks（可选，提交前自动检查）
prek install

# 检查已暂存文件
prek run

# 检查相对 main 的变更，与 CI 一致
prek run --from-ref origin/main --to-ref HEAD
```

## 构建系统

TjuaeUI 使用 **electron-vite** 快速打包：

- **主进程**：Vite 打包，输出 ESM
- **渲染进程**：Vite 打包 React + TypeScript
- **Preload 脚本**：Vite 打包

构建输出位于 `out/`：

- `out/main/`：主进程代码
- `out/renderer/`：渲染进程代码
- `out/preload/`：preload 脚本

## 技术栈

- **Electron**：跨平台桌面框架
- **React 19**：UI 框架
- **TypeScript**：类型安全
- **Vite**：快速打包，由 electron-vite 集成
- **UnoCSS**：原子化 CSS 引擎
- **better-sqlite3**：本地数据库
- **Vitest**：测试框架
