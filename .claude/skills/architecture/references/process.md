# 主进程与共享层

## `packages/desktop/src/process/` 结构

```text
packages/desktop/src/process/
├── bridge/        # IPC 处理器，每个业务域一个文件
│   ├── index.ts   # 注册全部桥接
│   └── *Bridge.ts # 各业务域桥接
├── services/      # 业务逻辑服务
│   ├── cron/      # 复杂服务使用子目录
│   └── mcp-services/
├── database/      # SQLite 层：模式、迁移、仓储
├── task/          # 智能体/任务管理：管理器、工厂
├── utils/         # 仅主进程使用的工具
└── i18n/          # 主进程国际化
```

## 命名规范

| 类型         | 模式                             | 示例                              |
| ------------ | -------------------------------- | --------------------------------- |
| 桥接         | `<domain>Bridge.ts`（camelCase） | `cronBridge.ts`、`webuiBridge.ts` |
| 服务         | `<Name>Service.ts`（PascalCase） | `CronService.ts`、`McpService.ts` |
| 服务接口     | `I<Name>Service.ts`              | `IConversationService.ts`         |
| 仓储         | `<Name>Repository.ts`            | `SqliteConversationRepository.ts` |
| 智能体管理器 | `<Platform>AgentManager.ts`      | `AcpAgentManager.ts`              |

全部目录使用全小写（Node.js 约定）：

```text
packages/desktop/src/process/
├── bridge/           # 全小写
├── services/         # 全小写
│   ├── cron/         # 全小写
│   └── mcp-services/ # 多单词使用 kebab-case
├── database/         # 全小写
└── task/             # 全小写
```

## 新增 IPC 桥接

1. 创建 `packages/desktop/src/process/bridge/<domain>Bridge.ts`
2. 在 `packages/desktop/src/process/bridge/index.ts` 注册
3. 在 `packages/desktop/src/preload/` 暴露通道
4. 按需补充渲染进程侧类型

## 新增服务

- 简单服务：在 `packages/desktop/src/process/services/` 放置单文件
- 复杂服务（多个文件）：建立 `packages/desktop/src/process/services/<name>/` 子目录

## 服务可测试性规则

### 分离纯逻辑与 IO

- **纯逻辑**（转换、校验、格式化）：独立函数，不得导入 `fs`、`db`、`net`
- **输入输出操作**（读文件、查数据库、HTTP 调用）：服务类或仓储中的薄封装
- 服务方法应尽量接收输入输出结果作为参数，而不是在内部直接读取

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

### 预加载层（`packages/desktop/src/preload/`）

主进程与渲染进程之间的 IPC 桥接，通过 `contextBridge` 暴露安全 API。

- 所有主进程 ↔ 渲染进程通信都必须经过此层
- 只允许使用 `contextBridge` 与 `ipcRenderer`
- 不得操作 DOM，不得直接使用 Node.js `fs`

### 共享层（`packages/desktop/src/common/`）

供主进程和渲染进程**共同导入**的代码。

- **应放入**：共享类型、API 适配器、协议转换器、存储键
- **不得放入**：React 组件应归入 `renderer/`；Node.js 专用实现应归入 `process/`

### 智能体（`packages/desktop/src/process/agent/`）

每个 AI 平台使用一个全小写目录，例如 `acp/`、`codex/`、`gemini/`、`nanobot/`、`openclaw/`。每个目录提供 `index.ts` 入口，并在主进程或工作进程中运行。

### 工作进程（`packages/desktop/src/process/worker/`）

```text
packages/desktop/src/process/worker/
├── fork/              # fork 管理
├── <platform>.ts      # 每个智能体平台一个文件，使用 lowercase
├── WorkerProtocol.ts  # 协议定义；类文件使用 PascalCase
└── index.ts
```

### 其他模块

| 模块     | 位置                                       | 用途                                   |
| -------- | ------------------------------------------ | -------------------------------------- |
| 消息渠道 | `packages/desktop/src/process/channels/`   | 多渠道消息（Lark、DingTalk、Telegram） |
| 扩展     | `packages/desktop/src/process/extensions/` | 插件加载、解析器、沙箱                 |
| Web 服务 | `packages/desktop/src/process/webserver/`  | 为 WebUI 提供 HTTP 与 WebSocket        |
| 适配器   | `packages/desktop/src/common/adapter/`     | 平台适配（浏览器环境与桌面环境）       |
