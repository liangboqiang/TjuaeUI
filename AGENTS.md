# TjuaeUI 项目指南

所有贡献者（包括人工开发者与 AI 智能体）在提交 PR 前，都必须遵循 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 代码规范

### 文件与目录结构

- **目录规模上限**：每个目录原则上不超过 **10** 个直接子项；新建或大幅重组的目录必须满足此要求。

完整规则见 [docs/contributing/file-structure.md](docs/contributing/file-structure.md)。创建文件或模块时，智能体还必须遵循 `architecture` 技能（`.claude/skills/architecture/SKILL.md`）。

### 命名

- **组件**：PascalCase（`Button.tsx`、`Modal.tsx`）
- **工具函数**：camelCase（`formatDate.ts`）
- **钩子**：带 `use` 前缀的 camelCase（`useTheme.ts`）
- **常量文件**：camelCase（`constants.ts`），文件内的常量值使用 UPPER_SNAKE_CASE
- **类型文件**：camelCase（`types.ts`）
- **样式文件**：kebab-case 或 `ComponentName.module.css`
- **未使用参数**：添加 `_` 前缀

### UI 组件库与图标

- **组件**：使用 `@arco-design/web-react`，不得用原生交互式 HTML（`<button>`、`<input>`、`<select>` 等）
- **图标**：使用 `@icon-park/react`

### CSS

- 优先使用 **UnoCSS 工具类**；复杂样式使用 **CSS Modules**（`ComponentName.module.css`）
- 颜色必须使用 `uno.config.ts` 中的**语义化令牌**或 CSS 变量，不得硬编码
- Arco 主题覆盖统一放在 `packages/desktop/src/renderer/styles/arco-override.css`；组件级 Arco 覆盖在 CSS Module 中使用 `:global()`
- 全局样式只能放在 `packages/desktop/src/renderer/styles/`

格式规则（Oxfmt，与 Prettier 兼容）：

- 能放在一行的单元素数组应保持行内形式：`[{ id: 'a', value: 'b' }]`
- 多行数组和对象必须保留尾随逗号
- 字符串使用单引号

### TypeScript 规范

- 已启用严格模式：禁止 `any`，禁止隐式返回
- 使用路径别名：`@/*`、`@process/*`、`@renderer/*`
- 按 Oxlint 配置优先使用 `type` 而非 `interface`
- 代码注释和公共函数 JSDoc 使用中文；协议名、API 名与代码标识符保持原样

### 国际化（i18n）

新增或修改的用户可见文本必须使用 i18n 键，不得引入硬编码字符串。语言和模块以 `packages/desktop/src/common/config/i18n-config.json` 为准。

完整流程、键命名和校验步骤见 `i18n` 技能（`.claude/skills/i18n/SKILL.md`）。

## 架构

项目包含两类进程，严禁混用其 API：

| 进程     | 路径                             | 限制                 |
| -------- | -------------------------------- | -------------------- |
| 主进程   | `packages/desktop/src/process/`  | 不得使用 DOM API     |
| 渲染进程 | `packages/desktop/src/renderer/` | 不得使用 Node.js API |

跨进程通信必须通过 IPC 桥接（`packages/desktop/src/preload/`）。详细说明见 [docs/architecture/overview.md](docs/architecture/overview.md)。

## 测试

**框架**：Vitest 4（`vitest.config.ts`）。项目覆盖率目标为 ≥ 80%；一般变更应为修改过的行为补充聚焦测试。

```bash
bun run test              # 运行全部测试
bun run test:coverage     # 运行测试并生成覆盖率报告
```

完整测试流程和质量规则见 `testing` 技能（`.claude/skills/testing/SKILL.md`）。

## 工作流程

### 范围与门禁

- **硬性阻断项**：违反进程边界、TypeScript 报错、测试失败、不安全的 IPC 用法、新增或修改的用户可见文本缺少 i18n，以及新 UI 使用原生交互式 HTML。
- **当前变更要求**：命名、CSS、文件位置、测试、文档、目录规模和单文件目录规则，适用于本次新建或实质修改的文件。
- **渐进收紧规则**：普通功能或缺陷修复不要求顺带清理既有的目录规模或单文件目录问题，但本次变更不得使问题恶化。
- **不得扩张范围**：除非用户明确要求，否则实施计划和代码审查不得额外增加清理任务、阶段或验收条件。
- **忽略的工作文档**：`docs/superpowers/` 专用于本地 Superpowers 规格与计划，已被 Git 忽略规则排除；不得强制添加或提交其中的文件。

### 开发过程中

编辑时及时自动修复：

```bash
bun run lint:fix       # 自动修复 lint 问题（oxlint）
bun run format         # 自动格式化全部文件（oxfmt）
bunx tsc --noEmit      # 确认没有类型错误
```

如果变更涉及 `packages/desktop/src/renderer/`、`locales/` 或 `packages/desktop/src/common/config/i18n`，还必须运行：

```bash
bun run i18n:types
node scripts/check-i18n.js
```

### 推送前

除非用户明确要求，否则 AI 智能体不得推送代码。需要推送时必须使用 `just push`，不得直接使用 `git push`：

```bash
just push                          # lint → format-check → typecheck → test → git push
just push -u origin feat/branch    # 执行相同检查，并附加 git push 参数
```

任一步骤失败都会中止推送。修复问题并提交后再重试。

> **AI 智能体注意事项**：`just push` 会为代码检查命令添加 `--quiet`；只有错误才会导致失败。项目中存在较多既有代码检查警告，它们不代表命令失败。应根据退出码判断结果，而不是根据输出量判断。

### PR 前可选的严格检查

`prek` 会复刻**完整 CI 流程**，包括对全部文件类型执行文件末尾和尾随空白检查：

```bash
# 首次安装
npm install -g @j178/prek

# 运行
prek run --from-ref origin/main --to-ref HEAD
```

> `prek` 只读，不会自动修复。若发现问题，先运行上面的自动修复命令，提交后再重新执行。

### 提交与 PR 格式

提交和 PR 标题必须遵循 [CONTRIBUTING.md](CONTRIBUTING.md) 规定的约定式提交格式；类型与范围使用约定的英文标识，主题使用简体中文：

```text
<type>(<scope>): <subject>
```

允许的类型：`feat`、`fix`、`perf`、`refactor`、`docs`、`style`、`chore`、`test`、`ci`、`build`。

创建 PR 时，使用 [.github/pull_request_template.md](.github/pull_request_template.md) 填写正文，并如实完成检查清单；只勾选实际运行或验证过的项目。

**严禁添加 AI 署名**（如 `Co-Authored-By`、`Generated with` 等）。

## 技能索引

| 技能             | 用途                                                         | 触发场景                                                                             |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **architecture** | 约束所有进程类型的文件与目录结构                             | 创建文件、添加模块、作出架构决策                                                     |
| **i18n**         | 国际化流程与标准                                             | 新增或修改用户可见文本，修改 `locales/` 或 `packages/desktop/src/common/config/i18n` |
| **testing**      | 测试流程与质量标准                                           | 编写测试、修改运行时行为、修复缺陷，或声称某项行为已验证                             |
| **bump-version** | 版本升级流程：更新 `package.json`、检查、分支、PR 与发布标签 | 升级版本、执行 `/bump-version`                                                       |

> 技能位于 `.claude/skills/`，其中的项目规范适用于**所有**智能体和贡献者。
