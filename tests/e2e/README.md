# 端到端测试指南

本目录使用 Playwright 驱动真实 Electron 窗口，覆盖 UI、主进程桥接和后端协作链路。测试会复用同一个 Electron 实例，因此用例必须清理自己创建的数据，且不能依赖执行顺序。

## 快速开始

### 1. 安装依赖并构建

开发模式通过项目根目录的 Electron 入口加载 `out/` 中的预构建文件。源码有变化时，运行测试前必须重新构建：

```bash
bun install
bun run package
```

打包模式需要先生成当前平台的未压缩应用目录：

```bash
node scripts/build-with-builder.js auto --win --pack-only
# macOS: node scripts/build-with-builder.js auto --mac --pack-only
# Linux: node scripts/build-with-builder.js auto --linux --pack-only
```

### 2. 准备 TjuaeCore

主进程启动时需要找到 `tjuaecore`。开发环境可在相邻的 TjuaeCore 仓库安装：

```bash
cd ../TjuaeCore
cargo install --path crates/tjuaeui-app
```

确认 Cargo 的二进制目录已加入启动 Playwright 的 `PATH`。若后端没有启动，`window.__backendPort` 会保持为 `0`，依赖 HTTP 桥接的测试将出现 `Failed to fetch`。

### 3. 运行测试

```bash
# 全部 E2E
bun run test:e2e

# 单个文件
bunx playwright test --config playwright.config.ts tests/e2e/specs/app-launch.e2e.ts --reporter=list

# Team 测试
bun run test:e2e:team
```

Windows PowerShell 设置环境变量的示例：

```powershell
$env:E2E_PACKAGED = '1'
$env:TEAM_AGENT = 'codex'
bun run test:e2e:team
```

查看 HTML 报告：

```bash
bunx playwright show-report tests/e2e/report
```

截图、跟踪和视频保存在 `tests/e2e/results/`，HTML 报告保存在 `tests/e2e/report/`。

## 启动架构

```text
Playwright worker
    → fixtures.ts 启动一个 Electron 实例
    → 主进程加载 out/main/index.js
    → BrowserWindow 加载 out/renderer/index.html
    → 测试通过 Page 操作渲染进程
    → 所有测试文件复用该实例
    → worker 退出时统一关闭应用
```

`playwright.config.ts` 固定使用单 worker 且关闭文件级并行，因为测试共享应用状态。不要在公共 fixture 中添加 `test.afterAll`；Playwright 会在每个 `test.describe` 后执行它，导致应用反复重启。

### 两种启动模式

| 模式     | 选择条件                     | 启动对象                      | 适用场景   |
| -------- | ---------------------------- | ----------------------------- | ---------- |
| 开发模式 | 本地默认，或 `E2E_DEV=1`     | 项目根目录的 Electron 入口    | 本地调试   |
| 打包模式 | CI 默认，或 `E2E_PACKAGED=1` | `out/` 下当前平台的未压缩应用 | 发布前验证 |

若同时设置两个变量，`E2E_PACKAGED=1` 优先。

## 目录结构

```text
tests/e2e/
├── fixtures.ts                 # Electron 生命周期与 Page fixture
├── helpers/                    # 导航、桥接、会话、断言等公共能力
│   ├── bridge/                 # invokeBridge 路由与调用封装
│   ├── navigation.ts
│   ├── conversation.ts
│   ├── teamConfig.ts
│   └── ...
├── specs/                      # 跨域和基础能力用例
├── features/                   # 按产品功能组织的用例
├── cases/teams/                # Team 专项用例
├── docs/                       # 需求、策略和实现映射
├── results/                    # 运行产物（不提交）
└── report/                     # HTML 报告（不提交）
```

Team 专项约束见 [specs/README.md](./specs/README.md)。

## 编写测试

### 基本模式

```ts
import { test, expect } from '../fixtures';
import { invokeBridge, navigateTo } from '../helpers';

test.describe('功能名称', () => {
  test('应完成预期行为', async ({ page }) => {
    await navigateTo(page, '#/some-route');

    const input = page.locator('textarea').first();
    await input.fill('Hello');
    await input.press('Enter');

    await expect(page.getByText('Hello')).toBeVisible({ timeout: 10_000 });

    const state = await invokeBridge<{ field: string }>(page, 'some.bridge-key', {
      param: 'value',
    });
    expect(state.field).toBe('expected');
  });
});
```

### 常用辅助函数

| 辅助函数                         | 用途                                         |
| -------------------------------- | -------------------------------------------- |
| `invokeBridge(page, key, data)`  | 调用主进程桥接，用于准备、契约测试或状态断言 |
| `navigateTo(page, hash)`         | 通过统一导航逻辑切换页面                     |
| `waitForAiReply(page)`           | 等待包含 Shadow DOM 的 AI 回复               |
| `selectAgent(page, backend)`     | 选择指定后端的可用助手                       |
| `sendMessageFromGuid(page, msg)` | 从首页发送消息并取得会话 ID                  |
| `deleteConversation(page, id)`   | 清理测试会话                                 |
| `MODE_SELECTOR`                  | 模式选择器定位符                             |
| `modeMenuItemByValue(value)`     | 模式菜单项定位符                             |

面向真实用户流程的测试应通过 UI 触发操作；只有明确验证桥接或后端契约的测试才直接调用 `invokeBridge` 执行操作。无论使用哪种方式，文件名和断言都必须准确说明测试层级。

### 等待与超时

- 元素可见：通常为 5～15 秒。
- 页面导航和稳定：通常为 10 秒。
- 单模型回复：最多约 120 秒。
- Team 推理与工具调用：通常为 60～120 秒。
- 成员初始化：通常为 60 秒。

优先使用 Playwright 的自动等待、`expect.poll()` 和明确的状态条件；不要用固定 `waitForTimeout()` 掩盖竞态。

### 原生对话框

```ts
await electronApp.evaluate(async ({ dialog }, targetPath) => {
  dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [targetPath] });
}, '/path/to/target');
```

### Shadow DOM

AI 消息正文位于 `.markdown-shadow` 的 Shadow DOM 中。常规回复等待应使用 `waitForAiReply()`；只有辅助函数无法覆盖的断言才直接访问 `shadowRoot`。

### 失败产物

自定义 `page` fixture 会在失败时附加截图。设置 `E2E_TRACE=1` 可保留失败跟踪和视频。

## 环境变量

| 变量             | 默认值                | 作用                                |
| ---------------- | --------------------- | ----------------------------------- |
| `E2E_PACKAGED=1` | 未设置                | 强制使用打包模式                    |
| `E2E_DEV=1`      | 未设置                | 强制使用开发模式                    |
| `E2E_TRACE=1`    | 未设置                | 保留失败跟踪和视频                  |
| `TEAM_AGENT`     | `claude,codex,gemini` | 过滤 Team leader 后端，可用逗号分隔 |
| `CI`             | 未设置                | 启用 CI 重试、报告和打包模式        |

fixture 会自动设置 `TJUAEUI_E2E_TEST=1`、`TJUAEUI_DISABLE_AUTO_UPDATE=1`、`TJUAEUI_DISABLE_DEVTOOLS=1` 和 `TJUAEUI_CDP_PORT=0`，并使用临时用户数据目录，避免污染开发者数据。

## 常用命令

| 命令                              | 范围                                |
| --------------------------------- | ----------------------------------- |
| `bun run test:e2e`                | 全部 E2E                            |
| `bun run test:e2e:team`           | `tests/e2e/cases/teams/` 下全部用例 |
| `bun run test:e2e:team:create`    | Team 创建                           |
| `bun run test:e2e:team:lifecycle` | Team 成员生命周期                   |
| `bun run test:e2e:team:whitelist` | leader 白名单                       |
| `bun run test:e2e:team:comm`      | Team 消息链路                       |

## 故障排查

### 页面仍是旧版本

重新运行 `bun run package`。E2E 不会自动重建源码。

### `Bridge invoke timeout: xxx`

1. 在 `packages/desktop/src/common/adapter/ipcBridge.ts` 或 HTTP 桥接定义中确认端点。
2. 在 `packages/desktop/src/process/bridge/` 中确认 provider 已注册。
3. 检查 `tjuaecore` 是否可执行、端口是否正常。
4. 重新构建后再运行。

### 应用启动后白屏

检查 `out/main/index.js` 和 `out/renderer/index.html` 是否存在，然后重新运行 `bun run package`。失败报告中的渲染进程诊断会列出脚本、样式和页面错误。

### AI 回复测试不稳定

- 确认本地 agent、认证和模型配置可用。
- 为真实推理设置合理超时。
- 使用状态轮询替代固定等待。
- MCP 确认弹窗统一复用已有自动批准辅助函数。

### 测试数据残留

优先通过桥接清理当前用例创建的数据，并在 `try/finally` 或测试收尾逻辑中执行。不要直接操作开发者数据库；fixture 默认使用临时用户数据目录。
