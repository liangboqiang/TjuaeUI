# TjuaeUI 代码审查风格指南

## 总览

本文规定 TjuaeUI 的编码标准和最佳实践。AI 代码审查者审查 PR 时必须以 [AGENTS.md](../AGENTS.md) 为最高优先级，并使用本指南作为摘要。

## 技术栈

- **运行时与包管理**：Bun
- **桌面框架**：Electron + electron-vite
- **前端框架**：React
- **语言**：TypeScript（strict mode）
- **组件与样式**：Arco Design、IconPark、UnoCSS、CSS Modules
- **状态与请求**：React Hooks、SWR
- **国际化**：react-i18next；支持语言以 `packages/desktop/src/common/config/i18n-config.json` 为准

## 代码质量标准

### TypeScript

- 使用严格 TypeScript 配置
- 禁止 `any`，改用 `unknown` 或准确的泛型
- 按 Oxlint 配置优先使用 `type`
- 导出函数使用明确的返回类型
- 合理使用可选链（`?.`）与空值合并（`??`）

### React

- 使用函数组件与 Hooks
- 只在确有计算或引用稳定收益时使用 `useMemo`、`useCallback`
- Hooks 的依赖数组必须完整
- 组件使用 PascalCase
- 交互组件优先使用 Arco，不得新建原生 `<button>`、`<input>`、`<select>` 等

### 错误处理

- 始终处理 Promise rejection
- `async`/`await` 调用使用恰当的异常处理
- 错误消息应可理解且能指导下一步
- 仅在适当位置使用 `console.error`，不得泄露敏感信息

### 安全

- 严禁提交 secret 或 API key
- 校验全部用户输入
- 渲染前处理不可信数据，避免 XSS
- Electron 中使用最小权限、带类型约束的安全 IPC
- 渲染进程不得直接访问 Node.js API

### 性能

- 适合时延迟加载组件
- 避免无意义的重复渲染
- 有证据时再使用 memoization
- 添加依赖时评估包体积与运行时成本

## 文件组织

```text
packages/desktop/src/
├── common/         # 跨进程共享工具、类型与 adapter
├── process/        # Electron 主进程与 Worker
├── preload/        # 安全 IPC 暴露层
└── renderer/       # React 渲染进程
    ├── components/ # 跨页面共享 UI
    ├── hooks/      # 共享 React Hooks
    ├── pages/      # 页面与页面私有业务
    └── services/   # 客户端服务与 i18n
```

完整目录规则见 `.claude/skills/architecture/SKILL.md`。

## Commit 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:`：新增功能
- `fix:`：缺陷修复
- `docs:`：文档
- `style:`：格式或样式
- `refactor:`：代码重构
- `perf:`：性能优化
- `test:`：测试
- `chore:`：维护工作

## 审查优先级

按以下顺序审查：

1. **安全性**：漏洞、secret 泄露、注入攻击
2. **正确性**：逻辑错误、边界场景、数据校验
3. **性能**：内存泄漏、无意义计算
4. **可维护性**：可读性与合理抽象
5. **风格**：命名与格式，优先级最低

## 语言

- 代码注释使用英文
- 变量和函数名必须清晰、可描述
- 仅使用行业通用缩写
- 用户可见文本必须通过 i18n 提供
