# 渲染层（`packages/desktop/src/renderer/`）

## 根目录标准布局

最多 3 个入口文件 + 7 个目录，共 10 个直接子项：

```text
packages/desktop/src/renderer/
├── index.html      # Vite HTML 入口
├── main.tsx        # React 挂载与应用启动
├── types.d.ts      # 环境类型声明
├── pages/          # 页面级模块（业务代码放在这里）
├── components/     # 跨页面复用的 UI 组件
├── hooks/          # 共享 React Hooks，可按业务域拆分子目录
├── context/        # 全局 React Context
├── services/       # 客户端服务与 i18n
├── utils/          # 工具函数、类型与常量
├── styles/         # 全局样式与主题配置
└── assets/         # 静态资源，由 Vite 解析为带 hash 的 URL
```

**以下内容不得放在渲染层根目录：**

- CSS 文件 → 放入 `styles/`
- 组件文件（`.tsx`）→ 放入 `components/` 或 `pages/`
- 单文件目录 → 合并到相关目录

## UI 组件库与图标规范

- **组件**：优先使用 `@arco-design/web-react`
- **图标**：全部使用 `@icon-park/react`
- **交互元素禁止使用原生 HTML**（`<button>`、`<input>`、`<select>` 等），应使用对应的 Arco 组件
- **布局标签**（`<div>`、`<span>`、`<section>` 等）可正常使用

## CSS 规范

- 优先使用 **UnoCSS** 工具类（`flex items-center gap-8px`）
- 复杂或可复用样式使用 CSS Modules（`ComponentName.module.css`）；组件不得使用普通 `.css`
- 只能使用语义化颜色令牌：使用 `uno.config.ts` 中的令牌（`text-t-primary`、`bg-base`、`border-b-base`）或 CSS 变量，禁止硬编码颜色；`CssThemeSettings/presets/` 中定义主题令牌的文件除外
- 除动态计算值外，禁止内联 `style`
- Arco 覆盖写在组件 CSS Module 中，并通过 `:global(.arco-xxx)` 限定；不得新建全局覆盖文件
- 全局样式只能位于 `packages/desktop/src/renderer/styles/`

## `components/` 分层结构

该目录分为两层。

**固定层：**

- `base/`：通用 UI 原语（Modal、Select、ScrollArea），不得包含业务逻辑，也不得依赖应用专用上下文

**业务层：**

- 按业务域创建全小写子目录；同一业务域出现 ≥ 2 个共享组件时再建目录
- 在同一业务域出现第二个组件前，单个组件可以暂时留在 `components/` 根目录

**约束：**

- 根目录直接子项不超过 10 个
- `base/` 不得依赖业务逻辑
- 只被一个页面使用的组件放入 `pages/<PageName>/components/`

```text
packages/desktop/src/renderer/components/
├── base/           # UI 原语
├── chat/           # 会话/消息业务域
├── agent/          # 智能体选择与配置
├── settings/       # 设置业务域
├── layout/         # 窗口框架与布局
├── media/          # 文件预览与图片查看
└── ...             # 按需增加新业务域
```

## `hooks/`：按业务域分组

直接子项超过 10 个时拆分子目录；无法明确归属业务域的通用钩子留在根目录。

```text
hooks/
├── agent/          # 智能体/模型：useModelProviderList、useAgentReadinessCheck
├── chat/           # 聊天/消息：useAutoTitle、useSendBoxDraft、useSlashCommands
├── file/           # 文件/工作区：useDragUpload、useOpenFileSelector
├── mcp/            # MCP 相关
├── ui/             # 通用 UI：useAutoScroll、useDebounce、useResizableSplit
├── system/         # 系统级：useDeepLink、useTheme、usePwaMode
└── index.ts        # 公共导出（可选）
```

## `utils/`：按业务域分组

规则与 `hooks/` 相同；直接子项超过 10 个时拆分。

```text
utils/
├── file/           # 文件处理：base64、fileType、download
├── workspace/      # 工作区：workspace、workspaceEvents、workspaceFs
├── chat/           # 聊天/消息：chatMinimapEvents、diffUtils、latexDelimiters
├── model/          # 模型/智能体：agentLogo、modelCapabilities、modelContextLimits
├── theme/          # 主题/样式：customCssProcessor、themeCssSync
├── ui/             # 通用 UI：clipboard、focus、siderTooltip、HOC
├── common.ts       # 其他通用工具
├── emitter.ts
└── platform.ts
```

## 页面模块结构

```text
PageName/                  # PascalCase
├── index.tsx              # 必需的入口文件
├── components/            # 页面私有组件，lowercase 分类目录
│   ├── FeatureA.tsx       # 简单子组件
│   └── FeatureB/          # 复杂子组件，PascalCase
│       └── index.tsx
├── hooks/                 # 页面私有 Hooks
├── contexts/              # 页面私有 React Context
├── utils/                 # 页面私有工具
├── types.ts
└── constants.ts
```

只创建实际需要的子目录，并使用以上固定名称。

## 页面级目录命名

| 类型                     | 规范       | 示例                                                                       |
| ------------------------ | ---------- | -------------------------------------------------------------------------- |
| **分类目录**（标准职责） | 全小写     | `components/`、`hooks/`、`context/`、`utils/`                              |
| **功能模块**（业务功能） | PascalCase | `GroupedHistory/`、`Workspace/`、`Preview/`                                |
| **平台目录**             | 全小写     | `acp/`、`codex/`、`gemini/`，与 `packages/desktop/src/process/agent/` 对齐 |

### 示例

```text
packages/desktop/src/renderer/
├── components/              # 分类目录 → 全小写
│   ├── SettingsModal/       # 组件 → PascalCase
│   └── EmojiPicker/         # 组件 → PascalCase
├── pages/                   # 分类目录 → 全小写
│   ├── settings/            # 顶级页面/路由段 → 全小写
│   │   ├── CssThemeSettings/   # 功能模块 → PascalCase
│   │   └── McpManagement/      # 功能模块 → PascalCase
│   └── conversation/        # 顶级页面 → 全小写
│       ├── GroupedHistory/  # 功能模块 → PascalCase
│       ├── Workspace/       # 功能模块 → PascalCase
│       ├── acp/             # 平台目录 → 全小写
│       └── components/      # 分类目录 → 全小写
└── hooks/                   # 分类目录 → 全小写
```

## 共享代码与页面私有代码

| 使用范围             | 位置                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- |
| 只被**一个**页面使用 | `pages/<PageName>/components/`、`hooks/` 等                                         |
| 被**多个**页面使用   | `packages/desktop/src/renderer/components/`、`packages/desktop/src/renderer/hooks/` |

**提升规则**：先保持页面私有；出现第二个使用方后再移动到共享目录。

## 组件入口

- 目录式组件必须以 `index.tsx` 作为公共入口
- 目录外部不得直接导入其内部文件
