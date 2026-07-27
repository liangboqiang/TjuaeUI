# 项目布局

## 根目录

### 规则

- **工作区根目录保持精简**：只放共享配置、脚本、测试、文档、资源和包管理文件。
- **桌面应用源码统一位于 `packages/desktop/`**：不得将新的应用运行时代码放回根目录。
- **README 的其他语言版本**放入 `docs/readme/`；根目录只保留主 `readme.md`。
- **指南文档**（`*_GUIDE.md`、`CODE_STYLE.md`）放入 `docs/` 对应子目录。
- **构建产物**（`out/`、`node_modules/`）由 gitignore 排除。

### 当前根目录结构（M1）

```text
project-root/
├── packages/
│   └── desktop/            # Electron 桌面工作区
├── tests/                  # 共享测试套件
├── docs/                   # 全部文档
├── scripts/                # 构建与工具脚本
├── resources/              # 静态资源（图标、图片、安装资源）
├── public/                 # 共享 Vite public 资源
├── patches/                # npm/Bun patches
├── package.json            # Workspace 根配置
├── tsconfig.json           # 共享 TypeScript 配置
├── vitest.config.ts        # 共享测试配置
├── AGENTS.md               # 智能体与贡献者规范
├── CLAUDE.md               # Claude 专用入口
└── ...                     # 其他根级工具配置
```

> **迁移规则**：新的桌面运行时模块必须进入 `packages/desktop/`，不得放在仓库根目录。

---

## `packages/desktop/` 布局

### Workspace 结构

```text
packages/desktop/
├── src/
│   ├── renderer/          # 渲染层：React UI，不使用 Node.js API
│   ├── process/           # 主进程层：Node.js / Electron 业务逻辑
│   ├── common/            # 跨进程共享代码
│   ├── preload/           # IPC 桥接入口
│   ├── index.ts           # 主进程入口
│   └── types.d.ts         # 环境类型声明
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

### `packages/desktop/src/` 结构

```text
packages/desktop/src/
├── renderer/              # React UI，仅浏览器环境代码
├── process/               # Electron 主进程与 Worker 代码
│   ├── bridge/            # IPC handler
│   ├── services/          # 业务逻辑
│   ├── agent/             # AI 平台连接
│   ├── channels/          # 多渠道消息
│   ├── extensions/        # 插件系统
│   ├── webserver/         # WebUI 服务
│   └── worker/            # 后台 Worker
├── common/                # 共享类型、adapter 与工具
├── preload/               # contextBridge / ipcRenderer 暴露层
├── index.ts               # 主进程入口
└── types.d.ts             # 环境类型声明
```

### 放置规则

- 新 Electron 运行时代码必须位于 `packages/desktop/src/**`。
- 根目录脚本和配置可以引用 `packages/desktop/**`，但不得复制一份应用源码。
- 测试继续放在 `tests/**`，并通过路径别名或 `packages/desktop/...` 路径引用桌面源码。
