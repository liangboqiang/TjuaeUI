# Team 端到端测试规范

本文件约束 `tests/e2e/cases/teams/` 下的 Team 测试。新增或修改用例前，还应先阅读上级目录的 [端到端测试指南](../README.md)。

## 产品链路

Tjuae Team 由 leader 驱动。leader 是一个可执行对话与调度的 agent，当前测试白名单为 `claude`、`codex` 和 `gemini`。成员管理既包含 UI 流程，也包含桥接与后端契约验证。

```text
用户或测试触发操作
    → leader / Team UI
    → 主进程桥接
    → TjuaeCore Team 能力
    → UI 状态与后端状态同步
```

测试名称必须明确自己验证的是完整用户流程、UI 状态还是桥接契约，不能用底层调用冒充用户操作。

## 后端白名单

E2E 的可测后端在 `tests/e2e/helpers/teamConfig.ts` 中集中定义：

```ts
const ALL_BACKENDS = new Set(['claude', 'codex', 'gemini']);
```

`TEAM_AGENT` 可在运行时过滤该集合，例如 `TEAM_AGENT=codex` 或 `TEAM_AGENT=claude,codex`。未知值会被忽略。

产品代码中的支持策略与 E2E 白名单职责不同：前者决定实际功能，后者决定稳定、可预测的测试矩阵。修改任意一侧时，都要检查另一侧是否需要同步。

## 测试分层

### UI 用户流程

创建 Team、切换页面、输入消息和点击控件等用户可见行为，应通过 Playwright 页面操作完成。

### 桥接与后端契约

当用例明确验证桥接参数、后端状态同步或难以稳定触发的底层契约时，可以使用 `invokeBridge`。此类测试必须：

- 在文件注释和测试名称中说明测试层级；
- 同时验证用户可观察的 UI 状态；
- 清理创建的 Team 和成员；
- 不依赖其他测试文件预先生成的数据。

### 状态查询与清理

`team.list`、`team.get` 等查询可用于前置检查和断言。`team.remove` 可用于清理本用例创建的数据。

## 参数化规则

同一行为需要覆盖多个 leader 时，优先在一个文件中遍历 `TEAM_SUPPORTED_BACKENDS`，不要为每个后端复制一套文件：

```ts
for (const backend of TEAM_SUPPORTED_BACKENDS) {
  test(`create team with ${backend}`, async ({ page }) => {
    // 共用同一套测试逻辑。
  });
}
```

如果真实模型调用在不同本地认证状态下不稳定，可以把发布门禁限定到已验证后端，同时用确定性的桥接、TCP 和 UI 测试覆盖公共契约。任何缩减都要在用例注释中写明原因。

## 当前用例布局

| 文件                                           | 主要职责                                 |
| ---------------------------------------------- | ---------------------------------------- |
| `team-create.e2e.ts`                           | 侧边栏入口、创建弹窗和白名单 leader 创建 |
| `team-agent-lifecycle.e2e.ts`                  | 自包含地创建 Team、添加成员并验证状态    |
| `team-whitelist.e2e.ts`                        | leader 选项与支持策略                    |
| `team-communication.e2e.ts`                    | 用户消息链路                             |
| `team-delete.e2e.ts` / `team-delete-ui.e2e.ts` | 删除契约与 UI                            |
| `team-member-ops.e2e.ts`                       | 成员操作契约                             |
| `team-member-messaging.e2e.ts`                 | leader 与成员消息                        |
| `team-rename-pin.e2e.ts`                       | 重命名与置顶                             |
| `team-session-mode.e2e.ts`                     | 会话模式传递                             |
| `team-tab-context.e2e.ts`                      | Tab 上下文持久化                         |
| `team-workspace-migration.e2e.ts`              | 工作区迁移                               |

目录中其余文件分别覆盖窄屏创建、名称校验、成员初始化失败、陈旧 URL 和视图模式等边界场景。

## 自包含与清理

每个文件必须能单独运行：

1. 使用唯一名称创建所需数据，例如拼接 `Date.now()`。
2. 不假设 `team-create.e2e.ts` 或其他文件已经运行。
3. 断言前确认所需 assistant 和后端可用；环境不满足时给出清晰的 `test.skip` 原因。
4. 测试完成或提前退出前删除本用例创建的 Team。
5. 不读取或修改开发者真实数据库。

共享 Electron 实例意味着前一个用例可能停留在任意路由。每个用例都要主动导航到自己的起点。

## 选择器

优先使用稳定的 `data-testid`：

| 元素              | 选择器                                       |
| ----------------- | -------------------------------------------- |
| 创建 Team         | `[data-testid="team-create-btn"]`            |
| Team Tab 栏       | `[data-testid="team-tab-bar"]`               |
| Team Tab          | `[data-testid^="team-tab-"]`                 |
| 创建页 agent 选项 | `[data-testid^="team-create-agent-option-"]` |
| 模式选择器        | `[data-testid="mode-selector"]`              |

只有缺少稳定测试标识时才使用文字或 CSS 结构定位。文字定位必须兼容简体中文和英文界面，避免依赖易变的布局层级。

## 等待策略

- UI 元素使用 `expect(locator).toBeVisible()` 等自动等待。
- Team 创建、成员初始化和模型工具调用使用与真实耗时相符的超时。
- 后端最终一致状态使用 `expect.poll()`。
- 禁止用大段固定 `waitForTimeout()` 代替状态判断。

## 运行方式

```bash
# 全部 Team 用例
bun run test:e2e:team

# 创建流程
bun run test:e2e:team:create

# 成员生命周期
bun run test:e2e:team:lifecycle

# 白名单
bun run test:e2e:team:whitelist

# 消息链路
bun run test:e2e:team:comm
```

Windows PowerShell 过滤后端：

```powershell
$env:TEAM_AGENT = 'gemini'
bun run test:e2e:team
```

## 提交前检查

- 用例能单独运行，并能在共享应用状态下重复运行。
- 用例名称准确描述测试层级。
- 多后端重复逻辑已参数化。
- 所有创建数据都有清理路径。
- 选择器不依赖脆弱 DOM 结构。
- 没有固定等待掩盖竞态。
- 修改支持后端后已同步检查产品策略、helper 和相关用例。
