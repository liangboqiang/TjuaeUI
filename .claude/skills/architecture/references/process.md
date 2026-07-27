# 主进程与共享层

## `packages/desktop/src/process/` 结构

```text
packages/desktop/src/process/
├── bridge/        # IPC handler，每个业务域一个文件
│   ├── index.ts   # 注册全部 bridge
│   └── *Bridge.ts # 各业务域 bridge
├── services/      # 业务逻辑 service
│   ├── cron/      # 复杂 service 使用子目录
│   └── mcp-services/
├── database/      # SQLite 层：Schema、迁移、Repository
├── task/          # 智能体/任务管理：Manager、Factory
├── utils/         # 仅主进程使用的工具
└── i18n/          # 主进程国际化
```

## 命名规范

| 类型          | 模式                             | 示例                              |
| ------------- | -------------------------------- | --------------------------------- |
| Bridge        | `<domain>Bridge.ts`（camelCase） | `cronBridge.ts`、`webuiBridge.ts` |
| Service       | `<Name>Service.ts`（PascalCase） | `CronService.ts`、`McpService.ts` |
| Service 接口  | `I<Name>Service.ts`              | `IConversationService.ts`         |
| Repository    | `<Name>Repository.ts`            | `SqliteConversationRepository.ts` |
| Agent Manager | `<Platform>AgentManager.ts`      | `AcpAgentManager.ts`              |

全部目录使用 lowercase（Node.js 约定）：

```text
packages/desktop/src/process/
├── bridge/           # lowercase
├── services/         # lowercase
│   ├── cron/         # lowercase
│   └── mcp-services/ # 多单词使用 kebab-case
├── database/         # lowercase
└── task/             # lowercase
```

## 新增 IPC Bridge

1. 创建 `packages/desktop/src/process/bridge/<domain>Bridge.ts`
2. 在 `packages/desktop/src/process/bridge/index.ts` 注册
3. 在 `packages/desktop/src/preload/` 暴露 channel
4. 按需补充渲染进程侧类型

## 新增 Service

- 简单 Service：在 `packages/desktop/src/process/services/` 放置单文件
- 复杂 Service（多个文件）：建立 `packages/desktop/src/process/services/<name>/` 子目录

## Service 可测试性规则

### 分离纯逻辑与 IO

- **纯逻辑**（转换、校验、格式化）：独立函数，不得导入 `fs`、`db`、`net`
- **IO 操作**（读文件、查数据库、HTTP 调用）：Service 类或 Repository 中的薄封装
- Service 方法应尽量接收 IO 结果作为参数，而不是在内部直接读取

### 依赖注入

```typescript
// ❌ 难以测试
import { db } from '@process/database';
function getConversation(id: string) {
  return db.query('SELECT * FROM conversations WHERE id = ?', id);
}

// ✅ 易于测试
function getConversation(repo: IConversationRepository, id: string) {
  return repo.findById(id);
}
```

既有代码使用直接导入时可以采用 `vi.mock()`；新代码优先使用参数注入。

---

## 共享层

### Preload（`packages/desktop/src/preload/`）

主进程与渲染进程之间的 IPC 桥接，通过 `contextBridge` 暴露安全 API。

- 所有主进程 ↔ 渲染进程通信都必须经过此层
- 只允许使用 `contextBridge` 与 `ipcRenderer`
- 不得操作 DOM，不得直接使用 Node.js `fs`

### Common（`packages/desktop/src/common/`）

供主进程和渲染进程**共同导入**的代码。

- **应放入**：共享类型、API adapter、协议转换器、存储键
- **不得放入**：React 组件应归入 `renderer/`；Node.js 专用实现应归入 `process/`

### Agent（`packages/desktop/src/process/agent/`）

每个 AI 平台使用一个 lowercase 目录，例如 `acp/`、`codex/`、`gemini/`、`nanobot/`、`openclaw/`。每个目录提供 `index.ts` 入口，并在主进程或 Worker 中运行。

### Worker（`packages/desktop/src/process/worker/`）

```text
packages/desktop/src/process/worker/
├── fork/              # fork 管理
├── <platform>.ts      # 每个智能体平台一个文件，使用 lowercase
├── WorkerProtocol.ts  # 协议定义；类文件使用 PascalCase
└── index.ts
```

### 其他模块

| 模块       | 位置                                       | 用途                                   |
| ---------- | ------------------------------------------ | -------------------------------------- |
| Channels   | `packages/desktop/src/process/channels/`   | 多渠道消息（Lark、DingTalk、Telegram） |
| Extensions | `packages/desktop/src/process/extensions/` | 插件加载、resolver、沙箱               |
| WebServer  | `packages/desktop/src/process/webserver/`  | 为 WebUI 提供 HTTP 与 WebSocket        |
| Adapter    | `packages/desktop/src/common/adapter/`     | 平台适配（浏览器环境与桌面环境）       |
