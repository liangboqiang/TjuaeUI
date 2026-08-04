---
name: i18n
description: |
  管理翻译的国际化（i18n）流程与标准。
  使用场景：(1) 新增用户可见文本；(2) 创建带用户可见文本的组件；
  (3) 审查 i18n 合规性；(4) 新增翻译模块。
---

# i18n 技能

本技能规定项目国际化的标准与流程。所有用户可见文本都必须使用 i18n。

**开始时声明：**“我将使用 i18n 技能确保国际化完整且符合规范。”

## 重要：先读取配置

开始任何 i18n 工作前，**必须先完整读取 `packages/desktop/src/common/config/i18n-config.json`**，获取当前支持的语言与模块。不得假定数量固定；该清单可能随项目演进而增删。

```bash
Get-Content packages/desktop/src/common/config/i18n-config.json
```

该文件是**唯一事实来源**。脚本、运行时代码和本流程都以它为准。

## 文件结构

```text
packages/desktop/src/common/config/i18n-config.json
    # 语言、参考语言和模块的唯一事实来源

packages/desktop/src/renderer/services/i18n/
├── index.ts                       # i18next 配置
├── i18n-keys.d.ts                 # 自动生成，严禁手动修改
└── locales/
    ├── <lang>/                    # i18n-config.json 中每种语言一个目录
    │   ├── index.ts               # 聚合导入全部模块
    │   ├── common.json            # 每个模块一个 JSON
    │   ├── conversation.json
    │   └── ...
    └── ...
```

### 关键事实

- **参考语言**：由 `i18n-config.json` 的 `referenceLanguage` 定义
- **支持语言**：由 `supportedLanguages` 数组定义
- **模块**：由 `modules` 数组定义

每次工作都应读取配置，不得仅依赖本文中的示例。

## 键结构

代码中使用带命名空间的点号形式：`t('module.key')` 或 `t('module.nested.key')`。

每个模块 JSON 内的键可以是平铺结构或嵌套结构：

```json
// common.json：平铺键
{
  "send": "Send",
  "cancel": "Cancel",
  "copySuccess": "Copied"
}
```

```json
// cron.json：嵌套键
{
  "scheduledTasks": "Scheduled Tasks",
  "status": {
    "active": "Active",
    "paused": "Paused"
  }
}
```

代码中：

```typescript
t('common.send'); // common.json 中的平铺键
t('cron.status.active'); // cron.json 中的嵌套键
```

### 键命名规则

- 键名使用 **camelCase**：`copySuccess`、`scheduledTasks`
- 相关键使用嵌套分组：`status.active`、`actions.pause`
- `save`、`cancel`、`delete`、`confirm` 等可复用文本放入 `common.json`
- 功能专用文本放入对应模块

### 常用后缀

| 后缀                | 用途           |
| ------------------- | -------------- |
| `title`             | 区块或页面标题 |
| `placeholder`       | 输入占位文本   |
| `label`             | 表单标签       |
| `success` / `error` | 状态消息       |
| `confirm`           | 确认对话框     |
| `empty`             | 空状态消息     |
| `tooltip`           | 工具提示文本   |

## 新增文本流程

### 第 1 步：读取 `i18n-config.json`

取得当前语言清单和模块清单，不得跳过。

### 第 2 步：检查既有键

新增键前先搜索相似键：

```bash
rg -n "keyword" packages/desktop/src/renderer/services/i18n/locales/en-US
```

可以复用时优先使用 `common.*` 键。

### 第 3 步：选择正确模块

模块应与功能域匹配。没有合适模块时，再判断是否确实需要新增模块（见下文“新增模块”）。

### 第 4 步：更新所有语言目录

**硬性要求：**每个新键必须加入 `supportedLanguages` 中的**每一种**语言。每个键都按以下清单核对：

- [ ] 参考语言的 `<module>.json`
- [ ] `zh-CN/<module>.json`
- [ ] `zh-TW/<module>.json`
- [ ] `supportedLanguages` 列出的其他全部语言

任一语言缺键都会导致 CI 中的 `node scripts/check-i18n.js` 失败。

### 第 5 步：在组件中使用

```tsx
import { Button } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <Button>{t('common.save')}</Button>;
}
```

### 第 6 步：重新生成类型并校验

必须按顺序运行以下命令，并在提交前确保两者都通过：

```bash
bun run i18n:types          # A：根据参考语言重新生成 i18n-keys.d.ts
node scripts/check-i18n.js  # B：校验结构、键一致性与类型同步
```

- 必须先运行 `i18n:types`，因为后续检查会验证生成文件
- `check-i18n.js` 返回错误（❌）时必须修复后再继续
- 只有警告（⚠️）时应人工复核，确认无误后方可继续
- 严禁提交过期的 `i18n-keys.d.ts`

## 新增模块

1. 将模块名加入 `packages/desktop/src/common/config/i18n-config.json` 的 `modules` 数组
2. 在每个 `supportedLanguages` 目录创建 `<module>.json`
3. 在每种语言的 `index.ts` 中补充导入与导出
4. 运行 `bun run i18n:types`
5. 运行 `node scripts/check-i18n.js`

## 硬编码字符串检查

### 禁止形式

JSX 中不得硬编码中文或英文用户文本：

```tsx
// 错误
<span>重命名</span>
<span>Delete</span>
{name || '新对话'}

// 正确
<span>{t('common.rename')}</span>
<span>{t('common.delete')}</span>
{name || t('conversation.newConversation')}
```

### 例外

- 代码注释，但仍须遵循 `AGENTS.md` 的中文注释规则
- `console.log()` 与调试输出
- 不会展示给用户的内部字符串常量

## 插值

### 变量

```json
{
  "taskCount": "{{count}} task(s)",
  "greeting": "Hello, {{name}}!"
}
```

```tsx
t('cron.taskCount', { count: 5 });
```

### 翻译中的复杂标记

复杂标记使用 `Trans` 组件：

```tsx
import { Trans } from 'react-i18next';

<Trans i18nKey='cron.countdown'>
  Task <strong>{{ taskName }}</strong> in <span>{{ countdown }}</span>
</Trans>;
```

## zh-TW 维护

简体中文可以辅助生成繁体中文初稿，但以下术语等差异必须人工复核：

| zh-CN | zh-TW | 说明     |
| ----- | ----- | -------- |
| 视频  | 影片  | 用词不同 |
| 软件  | 軟體  | 用词不同 |
| 信息  | 訊息  | 用词不同 |
| 默认  | 預設  | 用词不同 |

## 快速检查清单

提交含新文本的代码前：

- [ ] 已读取 `packages/desktop/src/common/config/i18n-config.json`
- [ ] 所有用户可见文本均使用 `t()`
- [ ] 新键已加入 `supportedLanguages` 的每个语言目录
- [ ] JSX 中没有硬编码中文或英文用户文本
- [ ] 已人工复核 zh-TW 术语
- [ ] 已先运行 `bun run i18n:types`
- [ ] 随后运行的 `node scripts/check-i18n.js` 已通过且无错误

## 常见错误

| 错误                              | 正确做法                                     |
| --------------------------------- | -------------------------------------------- |
| 假定语言数量固定                  | 每次先读取 `i18n-config.json`                |
| 只向部分语言添加键                | 更新 `supportedLanguages` 中的全部语言       |
| 手动编辑 `i18n-keys.d.ts`         | 运行 `bun run i18n:types` 生成               |
| 使用 `t("New Chat")`              | 先定义键，再使用 `t("conversation.newChat")` |
| 新增模块却未更新配置              | 先更新配置，再创建各语言文件                 |
| 新增模块 JSON 却未更新 `index.ts` | 在每个语言的 `index.ts` 中补充导入与导出     |
