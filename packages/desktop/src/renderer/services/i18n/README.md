# 多语言支持（i18n）

TjuaeUI 使用 i18next 与 react-i18next 提供多语言界面。

## 唯一事实来源

支持语言、参考语言和翻译模块统一由以下文件定义：

```text
packages/desktop/src/common/config/i18n-config.json
```

不得在文档或代码中维护另一份固定语言清单。新增翻译前应先读取该配置。

## 文件结构

```text
packages/desktop/src/renderer/services/i18n/
├── index.ts                 # i18next 配置
├── i18n-keys.d.ts           # 自动生成的键类型，严禁手动编辑
└── locales/
    ├── <language>/
    │   ├── index.ts         # 当前语言的模块聚合
    │   ├── common.json
    │   ├── conversation.json
    │   └── ...
    └── ...
```

## 在组件中使用

```tsx
import { Typography } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <Typography>
      <Typography.Title>{t('common.title')}</Typography.Title>
      <Typography.Paragraph>{t('common.description')}</Typography.Paragraph>
    </Typography>
  );
};
```

## 切换语言

```tsx
import { Select } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <Select
      value={i18n.language}
      options={[
        { label: '简体中文', value: 'zh-CN' },
        { label: 'English', value: 'en-US' },
      ]}
      onChange={(language) => void i18n.changeLanguage(language)}
    />
  );
};
```

产品中的语言选项应由统一配置和既有 UI 数据生成，不要复制上面的示例数组。

## 新增翻译

1. 读取 `packages/desktop/src/common/config/i18n-config.json`
2. 在参考语言中搜索可复用键
3. 选择正确模块，并向 `supportedLanguages` 的每个语言目录添加同一个键
4. 在代码中使用 `t('module.key')`
5. 依次运行：

```bash
bun run i18n:types
node scripts/check-i18n.js
```

## 键命名

- 代码中使用 `module.key` 或 `module.group.key`
- JSON 内部键使用 camelCase
- save、cancel、delete 等通用文本放入 `common.json`
- 功能专用文本放入对应模块

示例：

```json
{
  "send": "发送",
  "welcome": {
    "title": "今天有什么安排？"
  }
}
```

## 注意事项

1. 所有用户可见文本都必须使用翻译函数
2. 新键必须覆盖配置中列出的全部语言
3. 不得手动修改 `i18n-keys.d.ts`
4. 避免在 JSX 中硬编码用户文本
5. 完整规则见 [i18n 技能](../../../../../../.claude/skills/i18n/SKILL.md)
