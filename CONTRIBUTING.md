# 贡献指南

## 前置条件

环境搭建请参考 [docs/contributing/development.md](docs/contributing/development.md)。你需要：

- Node.js 22+
- [Bun](https://bun.sh)
- [Rust stable 与 Cargo](https://rustup.rs)，用于构建本地 TjuaeCore 后端
- [prek](https://github.com/j178/prek)（`npm install -g @j178/prek`）

## 规则一：原子化 PR

每个 PR 只能包含**一个不可再拆分的功能或一个缺陷修复**。

**判断方法：** 问自己（或 AI）：_“这个 diff 能否拆成多个可独立合并的 PR？”_ 如果可以，提交前必须拆分。

### 示例

**可接受的单个 PR：**

- 修复一个根因导致的缺陷，即使涉及多个文件（例如统一修复 toast 在 modal 与聊天层的 z-index）
- 实现一个完整且内聚的功能（例如带表单校验的团队创建弹窗）

**必须拆成多个 PR：**

- 团队聊天滚动修复 + 遥测集成 + 文档预览性能优化 = 3 个 PR
- 将多个无关缺陷打包（例如标题栏导航修复 + i18n 缺失键 + 语音输入 UI 修复）
- 同时改造彼此无关的技术层（例如 IPC 桥接重构 + 无关的渲染组件 + 无关的 Worker 进程变更）

## 规则二：Commit 与 PR 标题格式

Commit message 和 PR 标题必须使用 Conventional Commit 格式。`type` 与可选的 `scope` 使用约定的英文标识，`subject` 使用简体中文：

```text
<type>(<scope>): <subject>
```

`type` 只能使用以下取值：

| 类型       | 含义         | Changelog 可见性 |
| ---------- | ------------ | ---------------- |
| `feat`     | 新增用户功能 | 可见             |
| `fix`      | 缺陷修复     | 可见             |
| `perf`     | 性能优化     | 可见             |
| `refactor` | 代码重构     | 可见             |
| `docs`     | 文档         | 可见             |
| `style`    | 格式或样式   | 隐藏             |
| `chore`    | 维护工作     | 隐藏             |
| `test`     | 测试         | 隐藏             |
| `ci`       | CI 配置      | 隐藏             |
| `build`    | 构建系统     | 隐藏             |

示例：

- `fix(preview): 恢复本地 HTML 加载`
- `feat(workspace): 添加文件预览快捷键`
- `docs(contributing): 说明 PR 标题格式`

## 规则三：推送前通过本地检查

这些检查失败时，CI 会拒绝 PR。请在**推送前**于本地运行，以便尽早发现问题。

### 逐步执行

```bash
# 1. 格式化（必须运行，覆盖 .ts、.tsx、.css、.json、.md）
bun run format

# 2. Lint（未修改 .ts/.tsx 时可跳过）
bun run lint

# 3. 类型检查（未修改 .ts/.tsx 时可跳过）
bunx tsc --noEmit

# 4. i18n 校验（仅在修改 renderer、locales 或 i18n 配置时运行）
bun run i18n:types
node scripts/check-i18n.js

# 5. 测试
bunx vitest run
```

### 一组命令完成同等检查

以下命令先复刻 CI 质量门禁，再运行测试：

```bash
prek run --from-ref origin/main --to-ref HEAD
bunx vitest run
```

> `prek` 以只读方式运行 format-check、lint 与 tsc。若发现问题，先执行相应的自动修复命令，再重新运行 `prek`。

### 常见失败及修复

| 失败类型  | 修复方法                                             |
| --------- | ---------------------------------------------------- |
| 格式错误  | `bun run format`（自动修复）                         |
| Lint 错误 | 用 `bun run lint:fix` 修复可自动修复项，其余手动处理 |
| 类型错误  | 修复 TypeScript 问题，再运行 `bunx tsc --noEmit`     |
| i18n 错误 | 检查缺失键，并运行 `bun run i18n:types` 重新生成类型 |
| 测试失败  | 修复失败的测试或实现，再运行 `bunx vitest run`       |

## 规则执行

不符合规则时，维护者可以：

1. **关闭并要求重新提交**（首选）：正确重提后仍保留全部署名。
2. **Cherry-pick 有价值的部分**：作者信息保留在 git 历史中，但原 PR 会显示为 “Closed” 而非 “Merged”。

代码风格、依赖选择和文档润色由维护者在合并后统一处理。PR 应始终聚焦其功能变更。
