---
name: architecture
description: |
  适用于所有进程类型的项目架构与文件结构规范。
  使用场景：(1) 创建文件或模块；(2) 决定代码归属位置；
  (3) 将单文件组件改为目录；(4) 审查结构合规性；
  (5) 新增桥接、服务、智能体或工作进程。
---

# 架构技能

用于确定 Electron 多进程项目中的正确文件位置与组织方式。

## 详细参考

- **渲染层**（组件、钩子、工具函数、页面、CSS）：[references/renderer.md](references/renderer.md)
- **主进程与共享层**（桥接、服务、工作进程、预加载）：[references/process.md](references/process.md)
- **项目根目录与多项目单仓库布局**（目录结构、迁移状态）：[references/project-layout.md](references/project-layout.md)

---

## 决策树：新代码放在哪里？

```text
是否属于 UI（React 组件、Hooks、页面）？
  └── 是 → packages/desktop/src/renderer/              → 参见 references/renderer.md

是否属于响应渲染进程调用的 IPC 处理器？
  └── 是 → packages/desktop/src/process/bridge/        → 参见 references/process.md

是否属于在主进程运行的业务逻辑？
  └── 是 → packages/desktop/src/process/services/      → 参见 references/process.md

是否属于 AI 平台连接（API 客户端、消息协议）？
  └── 是 → packages/desktop/src/process/agent/<platform>/

是否属于在工作进程中运行的后台任务？
  └── 是 → packages/desktop/src/process/worker/

是否同时被主进程和渲染进程使用？
  └── 是 → packages/desktop/src/common/

是否属于 HTTP/WebSocket 端点？
  └── 是 → packages/desktop/src/process/webserver/

是否属于插件/扩展的解析器或加载器？
  └── 是 → packages/desktop/src/process/extensions/

是否属于消息渠道（Lark、DingTalk、Telegram）？
  └── 是 → packages/desktop/src/process/channels/
```

---

## 进程边界规则

**这是硬性规则，违反后会导致运行时崩溃。**

| 进程                                                   | 可以使用                                                    | 禁止使用                                         |
| ------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------ |
| **主进程**（`packages/desktop/src/process/`）          | Node.js、Electron 主进程 API、`fs`、`path`、`child_process` | DOM API（`document`、`window`、React）           |
| **渲染进程**（`packages/desktop/src/renderer/`）       | DOM API、React、浏览器 API                                  | Node.js API（`fs`、`path`）、Electron 主进程 API |
| **工作进程**（`packages/desktop/src/process/worker/`） | Node.js API                                                 | DOM API、Electron API                            |
| **预加载**（`packages/desktop/src/preload/`）          | `contextBridge`、`ipcRenderer`                              | DOM 操作、Node.js `fs`                           |

跨进程通信：

- 主进程 ↔ 渲染进程：通过 `packages/desktop/src/preload/` 与 `packages/desktop/src/process/bridge/*.ts` 的 IPC
- 主进程 ↔ 工作进程：通过 `packages/desktop/src/process/worker/WorkerProtocol.ts` 的派生进程协议

```typescript
// 渲染进程中严禁这样做
import { something } from '@process/services/foo'; // 运行时崩溃

// 应改用 IPC
const result = await window.api.someMethod(); // 经由 preload
```

---

## 命名规范

### 目录

| 范围                     | 规范       | 原因                                           |
| ------------------------ | ---------- | ---------------------------------------------- |
| **渲染层组件/模块目录**  | PascalCase | React 约定：目录名等于组件名                   |
| **其他所有目录**         | 全小写     | Node.js 约定                                   |
| **分类目录**（所有位置） | 全小写     | `components/`、`hooks/`、`utils/`、`services/` |
| **平台目录**（所有位置） | 全小写     | `acp/`、`codex/`、`gemini/`，保持跨进程一致    |

> 快速判断：“是否位于 `packages/desktop/src/renderer/` 中，并表示一个具体组件或功能（而不是分类）？”是则使用 PascalCase，否则使用全小写。

### 文件

| 内容               | 规范                            | 示例                                  |
| ------------------ | ------------------------------- | ------------------------------------- |
| React 组件、类     | PascalCase                      | `SettingsModal.tsx`、`CronService.ts` |
| 钩子               | 带 `use` 前缀的 camelCase       | `useTheme.ts`、`useCronJobs.ts`       |
| 工具函数、辅助函数 | camelCase                       | `formatDate.ts`、`cronUtils.ts`       |
| 入口文件           | `index.ts` / `index.tsx`        | 目录式模块必须提供                    |
| 配置、类型、常量   | camelCase                       | `types.ts`、`constants.ts`            |
| 样式               | kebab-case 或 `Name.module.css` | `chat-layout.css`                     |

---

## 结构规则

1. **按职责控制目录规模**：同一目录只容纳职责一致、变化原因相近的内容；当检索、命名或所有权开始含糊时再拆分，不设置脱离语境的固定数量上限。
2. **禁止单文件目录**：合并到父目录或相关目录。
3. **单文件与目录的选择**：组件需要私有子组件或钩子时，改为带 `index.tsx` 的目录。
4. **页面私有优先**：代码先放在 `pages/<PageName>/`；出现第二个使用方后再提升为共享代码。

## 测试文件映射

测试应在 `tests/` 对应子目录中映射源码：

| 源码                                                         | 测试                                            |
| ------------------------------------------------------------ | ----------------------------------------------- |
| `packages/desktop/src/process/services/CronService.ts`       | `tests/unit/cronService.test.ts`                |
| `packages/desktop/src/renderer/hooks/ui/useAutoScroll.ts`    | `tests/unit/useAutoScroll.dom.test.ts`          |
| `packages/desktop/src/process/extensions/ExtensionLoader.ts` | `tests/unit/extensions/extensionLoader.test.ts` |

`tests/unit/` 按源码职责映射拆分，避免仅为满足数量指标而增加无意义层级。

---

## 快速检查清单

- [ ] 代码位于正确的进程目录，没有跨进程导入
- [ ] 渲染进程代码未使用 Node.js API
- [ ] 主进程代码未使用 DOM API
- [ ] 新 IPC 通道已通过 `preload/` 桥接
- [ ] 渲染层组件/模块目录使用 PascalCase，分类目录使用全小写
- [ ] 所有平台目录均使用全小写
- [ ] 目录式模块提供 `index.tsx` 或 `index.ts`
- [ ] 页面私有代码位于 `pages/<PageName>/`，而非共享目录
- [ ] 没有单文件目录
- [ ] 目录按职责组织，层级与规模不会造成归属歧义
- [ ] 新源码会自动进入覆盖率范围；确认未被 `vitest.config.ts` 的 `coverage.exclude` 意外排除
- [ ] 新服务已将纯逻辑与输入输出分离
