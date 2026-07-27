# 文件与目录结构

本文规定整个 Electron 项目的文件和目录组织方式。

## 仓库根目录

### 根目录规则

- README 的其他语言版本放入 `docs/readme/`；根目录只保留主 `readme.md`
- 部署、测试、WebUI、CDP 等操作指南放入 `docs/guides/`
- 开发环境、代码风格、文件结构和 PR 流程放入 `docs/contributing/`
- 架构文档放入 `docs/architecture/`
- 功能规格、PRD 与设计草案放入 `docs/prds/`
- `tsconfig.json`、`package.json` 等生态配置文件保留在根目录
- 新文档必须进入 `docs/` 的适当子目录，不得直接堆放在根目录

## 桌面项目布局

TjuaeUI 是多进程 Electron 应用，包含**渲染进程、主进程、preload 与共享层**。

### 目标结构

```text
packages/desktop/src/
├── renderer/          # 渲染层：React UI，不使用 Node.js API
├── process/           # 主进程层：Node.js / Electron 业务
│   ├── bridge/        # IPC handler
│   ├── services/      # 业务逻辑
│   ├── database/      # SQLite
│   ├── task/          # 智能体/任务管理
│   ├── agent/         # AI 平台连接
│   ├── channels/      # 多渠道消息
│   ├── extensions/    # 插件系统
│   ├── webserver/     # WebUI server
│   ├── worker/        # 后台 Worker
│   └── i18n/          # 主进程 i18n
├── common/            # 跨进程共享类型、adapter 与工具
├── preload/           # 主进程 ↔ 渲染进程 IPC 桥接
├── index.ts           # 主进程入口
└── types.d.ts         # 环境类型声明
```

主进程模块统一位于 `packages/desktop/src/process/`。`packages/desktop/src/` 根目录只保留四个核心层、入口文件与环境类型声明。

## 目录命名：按进程采用两套约定

项目横跨 React 与 Node.js 两个生态，各自遵循其约定：

| 范围                             | 目录命名   | 原因                                                    |
| -------------------------------- | ---------- | ------------------------------------------------------- |
| **渲染层具体组件/功能模块**      | PascalCase | React 约定：目录名等于组件或功能名                      |
| **其他目录**                     | lowercase  | Node.js 约定                                            |
| **分类目录**（所有位置）         | lowercase  | `components/`、`hooks/`、`utils/`、`services/` 表示类别 |
| **平台目录**（渲染页面中也一样） | lowercase  | 与 `process/agent/<platform>/` 保持跨进程一致           |

### 快速判断

> “该目录是否位于 `packages/desktop/src/renderer/` 中，并表示一个具体组件或功能模块，而不是类别？”
>
> **是** → PascalCase；**否** → lowercase。
>
> **例外**：`acp/`、`codex/`、`gemini/`、`nanobot/`、`openclaw/` 等平台目录始终使用 lowercase。

### 渲染层示例

```text
packages/desktop/src/renderer/
├── components/              # 分类 → lowercase
│   ├── SettingsModal/       # 组件 → PascalCase
│   └── EmojiPicker/         # 组件 → PascalCase
├── pages/                   # 分类 → lowercase
│   ├── settings/            # 顶级页面/路由段 → lowercase
│   │   ├── CssThemeSettings/   # 功能模块 → PascalCase
│   │   └── McpManagement/      # 功能模块 → PascalCase
│   └── conversation/        # 顶级页面 → lowercase
│       ├── GroupedHistory/  # 功能模块 → PascalCase
│       ├── Workspace/       # 功能模块 → PascalCase
│       ├── acp/             # 平台目录 → lowercase
│       └── components/      # 分类 → lowercase
└── hooks/                   # 分类 → lowercase
```

### 非渲染层示例

```text
packages/desktop/src/process/services/cron/
packages/desktop/src/process/agent/acp/
packages/desktop/src/process/channels/plugins/dingtalk/
```

## 文件命名：全项目统一

| 内容             | 规范                            | 示例                                  |
| ---------------- | ------------------------------- | ------------------------------------- |
| React 组件、类   | PascalCase                      | `SettingsModal.tsx`、`CronService.ts` |
| Hooks            | 带 `use` 前缀的 camelCase       | `useTheme.ts`、`useCronJobs.ts`       |
| 工具与辅助函数   | camelCase                       | `formatDate.ts`、`cronUtils.ts`       |
| 入口文件         | `index.ts` / `index.tsx`        | 目录式模块必须提供                    |
| 配置、类型、常量 | camelCase                       | `types.ts`、`constants.ts`            |
| 样式             | kebab-case 或 `Name.module.css` | `chat-layout.css`                     |

## 进程边界

**违反这些规则会导致运行时崩溃。**

| 进程                                                 | 可以使用                       | 禁止使用                     |
| ---------------------------------------------------- | ------------------------------ | ---------------------------- |
| **主进程**（`packages/desktop/src/process/`）        | Node.js、Electron 主进程 API   | DOM API、React               |
| **渲染进程**（`packages/desktop/src/renderer/`）     | DOM、React、浏览器 API         | Node.js、Electron 主进程 API |
| **Worker**（`packages/desktop/src/process/worker/`） | Node.js API                    | DOM API、Electron API        |
| **Preload**（`packages/desktop/src/preload/`）       | `contextBridge`、`ipcRenderer` | 业务 UI、无约束文件系统访问  |

跨进程通信必须经过：

- 主进程 ↔ 渲染进程：`packages/desktop/src/preload/` 与 `packages/desktop/src/process/bridge/*.ts`
- 主进程 ↔ Worker：`packages/desktop/src/process/worker/WorkerProtocol.ts`

## 主进程命名

| 类型       | 模式                  | 示例                              |
| ---------- | --------------------- | --------------------------------- |
| Bridge     | `<domain>Bridge.ts`   | `cronBridge.ts`、`webuiBridge.ts` |
| Service    | `<Name>Service.ts`    | `CronService.ts`、`McpService.ts` |
| Interface  | `I<Name>Service.ts`   | `IConversationService.ts`         |
| Repository | `<Name>Repository.ts` | `SqliteConversationRepository.ts` |

## Service 可测试性

### 分离纯逻辑与 IO

- **纯逻辑**（数据转换、校验、格式化）：使用独立函数，不导入 `fs`、`db`、`net`
- **IO 操作**（文件读取、数据库查询、HTTP 调用）：放在 Service 类或 Repository 的薄封装中
- Service 方法尽量接收 IO 结果作为参数，而不是内部直接读取

### 依赖注入

依赖数据库、文件系统或其他 Service 的代码，应通过构造函数或函数参数接收依赖：

```typescript
// ❌ 难以测试：必须 mock 整个模块
import { db } from '@process/database';
function getConversation(id: string) {
  return db.query('SELECT * FROM conversations WHERE id = ?', id);
}

// ✅ 易于测试：显式注入依赖
function getConversation(repo: IConversationRepository, id: string) {
  return repo.findById(id);
}
```

既有代码使用直接导入时可以采用 `vi.mock()`；新代码优先参数注入。

## 测试文件映射

测试文件应映射其源码：

| 源码                                                          | 测试                                            |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `packages/desktop/src/process/services/CronService.ts`        | `tests/unit/cronService.test.ts`                |
| `packages/desktop/src/process/bridge/fsBridge.ts`             | `tests/unit/fsBridge.test.ts`                   |
| `packages/desktop/src/renderer/utils/chat/latexDelimiters.ts` | `tests/unit/latexDelimiters.test.ts`            |
| `packages/desktop/src/renderer/hooks/ui/useAutoScroll.ts`     | `tests/unit/useAutoScroll.dom.test.ts`          |
| `packages/desktop/src/process/extensions/ExtensionLoader.ts`  | `tests/unit/extensions/extensionLoader.test.ts` |

当 `tests/unit/` 超过 10 个直接子项时，按源码结构拆分子目录。包含逻辑的新源码文件应进入 `vitest.config.ts` 的 `coverage.include`，不得被 `coverage.exclude` 意外排除。

## 目录规模上限

每个目录不得超过 **10** 个直接子项（文件 + 子目录）。接近上限时，按职责拆分子目录。

## UI 组件库与图标

- **组件库**：`@arco-design/web-react`；新 UI 必须优先使用 Arco
- **图标库**：`@icon-park/react`；图标必须来自此库
- **禁止原生交互元素**：不得使用 `<button>`、`<input>`、`<select>`、`<textarea>`、`<modal>` 等；使用 Arco 的 `Button`、`Input`、`Select`、`Modal` 等
- **允许布局标签**：`<div>`、`<span>`、`<section>`、`<nav>`、`<main>` 等纯布局/语义标签可正常使用

## CSS 规范

- **优先 UnoCSS 工具类**：简单样式使用原子类（`flex items-center gap-8px`）
- **复杂或复用样式**：使用 CSS Modules（`ComponentName.module.css`），组件样式不得使用普通 `.css`
- **只用语义化颜色**：使用 `uno.config.ts` 的令牌（如 `text-t-primary`、`bg-base`、`border-b-base`）或 CSS 变量，禁止 `#86909C`、`rgb(...)` 等硬编码；主题 preset 文件因负责定义令牌而例外
- **禁止静态内联样式**：`style={{}}` 仅用于动态计算的宽度、位置等值
- **Arco 样式覆盖**：在组件 CSS Module 中使用 `:global(.arco-xxx)`
- **全局样式**：只允许位于 `packages/desktop/src/renderer/styles/`

## 渲染层根目录标准布局

渲染层根目录最多包含 3 个入口文件 + 7 个目录，共 10 个直接子项：

```text
packages/desktop/src/renderer/
├── index.html      # Vite HTML 入口
├── main.tsx        # React 挂载与应用启动
├── types.d.ts      # 环境类型声明
├── pages/          # 页面级模块
├── components/     # 跨页面共享组件
├── hooks/          # 共享 Hooks
├── context/        # 全局 Context
├── services/       # 客户端服务与 i18n
├── utils/          # 工具、类型、常量
├── styles/         # 全局样式与主题
└── assets/         # 静态资源
```

渲染层根目录不得放置：

- CSS 文件，应移入 `styles/`
- `.tsx` 组件文件，应移入 `components/` 或 `pages/`
- 只含一个文件的目录，应并入父目录或相关目录

## 渲染组件规则

- 自包含组件使用单文件；存在私有子组件或 Hook 时使用目录
- 目录式组件必须提供 `index.tsx`
- 单文件目录应合并到父目录或相关目录
- 页面私有代码留在 `pages/<PageName>/`；出现第二个使用方后再移入共享层

### `components/` 结构

`components/` 只放跨页面共享组件，分为两层。

**固定层：**

- `base/`：无业务逻辑的通用 UI 原语，不得依赖应用专用 Context 或业务逻辑

**业务层：**

- 按业务域创建 lowercase 子目录
- 同一业务域有 ≥ 2 个共享组件时再建立子目录
- 同域第二个组件出现前，单个组件可以暂时留在根目录

**约束：**

- `components/` 根目录不超过 10 个直接子项
- 只被一个页面使用的组件必须放在 `pages/<PageName>/components/`

```text
packages/desktop/src/renderer/components/
├── base/           # UI 原语
├── chat/           # 会话/消息
├── agent/          # 智能体选择与配置
├── settings/       # 设置
├── layout/         # 窗口框架与布局
├── media/          # 文件与图片查看
└── index.ts        # 公共导出（可选）
```

### `hooks/` 按业务域分组

`hooks/` 超过 10 个直接子项时按业务域拆分；无法明确归类的通用 Hook 留在根目录。

```text
hooks/
├── agent/          # 智能体/模型
├── chat/           # 聊天/消息输入
├── file/           # 文件/工作区
├── mcp/            # MCP
├── ui/             # 通用 UI 交互
├── system/         # Deep Link、通知、主题等系统能力
└── index.ts        # 公共导出（可选）
```

### `utils/` 按业务域分组

规则与 `hooks/` 相同；根目录不超过 10 个直接子项。

```text
utils/
├── file/           # 文件处理
├── workspace/      # 工作区工具
├── chat/           # 聊天/消息工具
├── model/          # 模型/智能体工具
├── theme/          # 主题/样式工具
├── ui/             # 通用 UI 工具
└── ...             # 暂未分组的根级工具
```

### 页面模块结构

```text
PageName/                  # PascalCase
├── index.tsx              # 必需入口
├── components/            # lowercase 分类目录
├── hooks/                 # lowercase 分类目录
├── contexts/              # lowercase 分类目录
├── utils/                 # lowercase 分类目录
├── types.ts
└── constants.ts
```

### 页面级目录命名

| 类型                                  | 规范       | 示例                                                 |
| ------------------------------------- | ---------- | ---------------------------------------------------- |
| **分类目录**（标准职责）              | lowercase  | `components/`、`hooks/`、`context/`、`utils/`        |
| **功能模块**（业务功能）              | PascalCase | `GroupedHistory/`、`Workspace/`、`Preview/`          |
| **平台目录**（映射 `process/agent/`） | lowercase  | `acp/`、`codex/`、`gemini/`、`nanobot/`、`openclaw/` |

平台目录是 PascalCase 规则的例外，以保持跨进程命名一致。
