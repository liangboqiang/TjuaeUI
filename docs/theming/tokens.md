# 主题语义 Token 参考

本文是 TjuaeUI 主题系统使用的语义化设计 Token 权威清单。`Theme`（`packages/desktop/src/common/theme/types.ts`）可以通过可选的 `tokens` 映射或原始 `css` 覆盖它们。内置 Light/Dark 主题依赖由 `appearance` → `data-theme` 驱动的基底样式；装饰主题和用户主题使用 `css`。

## Token 如何生效

- **基底值唯一来源**：`packages/desktop/src/renderer/styles/themes/default-color-scheme.css`
  - `:root, [data-color-scheme='default']`：亮色值
  - `[data-color-scheme='default'][data-theme='dark']`：暗色值
- 当前主题的 **`appearance`**（`'light' | 'dark'`）会设置 `<html data-theme>` 与 `<body arco-theme>`，从而选择对应基底
- 可选的 **`theme.tokens`** 由 `applyTheme()` 写入 `<style id="theme-tokens">:root { … }</style>`；键必须带 `--` 前缀，例如 `{ "--primary": "#7c3aed" }`
- 可选的 **`theme.css`** 会作为原始装饰 CSS 注入 `<style id="theme-decoration">`，并自动添加 `!important`；装饰 preset 与用户主题使用该方式
- **UnoCSS 桥接**：`uno.config.ts` 将工具类映射到这些变量，例如 `bg-1` → `background: var(--bg-1)`，`text-t-secondary` → `var(--text-secondary)`；覆盖 Token 后，所有使用方会一起变化

未显式提供暗色值的 Token 会继承暗色基底。装饰主题需要不同暗色值时，应在 `css` 中同时覆盖 `:root` 与 `[data-theme='dark']`。

## Token 清单

### 品牌色阶（`--aou-*`）

10 级品牌色阶。亮色模式由浅到深；暗色模式反转，因此暗色下 `--aou-1` 最深。用于品牌底色、首页 Agent 栏和强调元素。

| Token      | Light     | Dark      | 用途                         |
| ---------- | --------- | --------- | ---------------------------- |
| `--aou-1`  | `#eff0f6` | `#2a2a2a` | 最浅品牌染色/表面底色        |
| `--aou-2`  | `#e5e7f0` | `#3d4150` | 品牌染色、首页 Agent 栏底色  |
| `--aou-3`  | `#d1d5e5` | `#525a77` | 品牌染色                     |
| `--aou-4`  | `#b5bcd6` | `#6a749b` | 品牌染色                     |
| `--aou-5`  | `#97a0c5` | `#838fba` | 品牌中间色                   |
| `--aou-6`  | `#7583b2` | `#a1aacb` | 品牌基色，亮色等于 `--brand` |
| `--aou-7`  | `#596590` | `#b5bcd6` | 强品牌色                     |
| `--aou-8`  | `#3f4868` | `#d1d5e5` | 强品牌色                     |
| `--aou-9`  | `#262c41` | `#e5e7f0` | 最深品牌染色                 |
| `--aou-10` | `#0d101c` | `#eff0f6` | 品牌极值                     |

### 背景（`--bg-*`）

分层表面色阶；亮色模式中数字越大，分隔越强、颜色越深。

| Token         | Light     | Dark      | 用途                       |
| ------------- | --------- | --------- | -------------------------- |
| `--bg-base`   | `#ffffff` | `#0e0e0e` | 应用主背景（`bg-0`）       |
| `--bg-1`      | `#f9fafb` | `#1a1a1a` | 次级表面：面板、卡片       |
| `--bg-2`      | `#f2f3f5` | `#262626` | 三级表面：嵌套卡片、当前行 |
| `--bg-3`      | `#e5e6eb` | `#333333` | 边框与分隔线               |
| `--bg-4`      | `#c9cdd4` | `#404040` | 强分隔或弱填充             |
| `--bg-5`      | `#adb4c1` | `#4d4d4d` | 弱化元素                   |
| `--bg-6`      | `#86909c` | `#5a5a5a` | 禁用状态或填充上的次要文字 |
| `--bg-8`      | `#4e5969` | `#737373` | 强中性色                   |
| `--bg-9`      | `#1d2129` | `#a6a6a6` | 接近反色的中性色           |
| `--bg-10`     | `#0c0e12` | `#d9d9d9` | 中性色极值                 |
| `--bg-hover`  | `#f3f4f6` | `#1f1f1f` | Hover 背景                 |
| `--bg-active` | `#e5e6eb` | `#2d2d2d` | Active/pressed 背景        |

### 文字（`--text-*`、`--color-text-1`）

| Token              | Light     | Dark      | 用途                                                       |
| ------------------ | --------- | --------- | ---------------------------------------------------------- |
| `--text-primary`   | `#000000` | `#ffffff` | 主要文字                                                   |
| `--color-text-1`   | `#000000` | `#ffffff` | Arco 主要文字，与 `--text-primary` 对齐                    |
| `--text-secondary` | `#454d5f` | `#ced3da` | 次要文字，亮/暗对比度约 7.5:1 / 11:1                       |
| `--text-disabled`  | `#c9cdd4` | `#737373` | 禁用文字                                                   |
| `--text-0`         | `#000000` | `#ffffff` | 随模式反转的纯黑/白文字；当前未使用，优先 `--text-primary` |
| `--text-white`     | `#ffffff` | `#ffffff` | 始终为白色，用于有色填充                                   |

### 语义状态

| Token       | Light     | Dark      | 用途                           |
| ----------- | --------- | --------- | ------------------------------ |
| `--primary` | `#165dff` | `#4d9fff` | 主操作与强调                   |
| `--success` | `#00b42a` | `#23c343` | 成功                           |
| `--warning` | `#ff7d00` | `#ff9a2e` | 警告                           |
| `--danger`  | `#f53f3f` | `#f76560` | 错误或危险操作                 |
| `--info`    | `#165dff` | `#4d9fff` | 信息；当前组件使用 `--primary` |

### 边框

| Token              | Light         | Dark      | 用途                                           |
| ------------------ | ------------- | --------- | ---------------------------------------------- |
| `--border-base`    | `#e5e6eb`     | `#333333` | 默认边框                                       |
| `--border-light`   | `#f2f3f5`     | `#262626` | 弱边框                                         |
| `--border-special` | `var(--bg-3)` | `#60677e` | 特殊强调边框；当前未使用，优先 `--border-base` |

### 品牌强调

| Token           | Light     | Dark      | 用途          |
| --------------- | --------- | --------- | ------------- |
| `--brand`       | `#7583b2` | `#a1aacb` | 品牌色        |
| `--brand-light` | `#eff0f6` | `#3d4150` | 品牌浅/深底色 |
| `--brand-hover` | `#b5bcd6` | `#6a749b` | 品牌 Hover    |

### 填充与反色

| Token                   | Light     | Dark                     | 用途                        |
| ----------------------- | --------- | ------------------------ | --------------------------- |
| `--fill`                | `#f7f8fa` | `#1a1a1a`                | 通用填充                    |
| `--fill-0`              | `#ffffff` | `rgba(255,255,255,0.08)` | 0 级填充，暗色下半透明      |
| `--fill-white-to-black` | `#ffffff` | `#000000`                | 随模式在白/黑之间切换的表面 |
| `--dialog-fill-0`       | `#ffffff` | `#333333`                | Dialog/Modal 填充           |
| `--inverse`             | `#ffffff` | `#ffffff`                | 反色                        |

### 组件专用

| Token                    | Light     | Dark           | 用途                  |
| ------------------------ | --------- | -------------- | --------------------- |
| `--message-user-bg`      | `#e9efff` | `#1e2a3a`      | 用户消息气泡背景      |
| `--message-tips-bg`      | `#f0f4ff` | `#1a2333`      | 提示/通知背景         |
| `--workspace-btn-bg`     | `#eff0f1` | `#1f1f1f`      | 工作区按钮背景        |
| `--color-guid-agent-bar` | `#eaecf7` | `var(--aou-2)` | 首页 Agent 选择条背景 |

### Arco `--color-*` 别名

Arco Design 组件读取自己的 `--color-*` 变量，例如 `--color-bg-1`、`--color-primary`、`--color-primary-light-1..3`、`--color-border`、`--color-fill`。内置和装饰 preset 会将它们映射到上述语义 Token，见 `presets/default.css` 与 `styles/arco-override.css`。希望 Arco 组件完整跟随的主题，也应设置相关 `--color-*` 别名。

## 代码如何使用 Token

多数组件不会直接写 `var(--token)`，而是使用 `uno.config.ts` 中桥接的 UnoCSS 工具类。因此原始 `var()` 搜索次数少，不代表 Token 未使用。

| Token                                                           | UnoCSS 类                                                |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `--bg-base`、`--bg-1..10`                                       | `bg-base`、`bg-1`…`bg-10`、`border-base`、`border-1`…    |
| `--bg-hover`、`--bg-active`                                     | `bg-hover`、`bg-active`                                  |
| `--text-primary`                                                | `text-t-primary`                                         |
| `--text-secondary`                                              | `text-t-secondary`                                       |
| `--bg-6`（作为三级文字）                                        | `text-t-tertiary`                                        |
| `--text-disabled`                                               | `text-t-disabled`                                        |
| `--primary` / `--success` / `--warning` / `--danger` / `--info` | `bg-*`、`text-*`、`border-*`                             |
| `--border-base`、`--border-light`                               | `border-b-base`、`border-b-light`                        |
| `--brand`、`--brand-light`、`--brand-hover`                     | `bg-brand`、`bg-brand-light`、`bg-brand-hover`           |
| `--aou-1..10`                                                   | `bg-aou-*`、`text-aou-*`、`border-aou-*`                 |
| 消息与工作区专用背景 Token                                      | `bg-message-user`、`bg-message-tips`、`bg-workspace-btn` |
| `--fill`、`--inverse`                                           | `bg-fill`、`text-fill`、`bg-inverse`、`text-inverse`     |
| Arco 的 `--color-text-1..4`                                     | `text-1`…`text-4`                                        |

通过 `tokens` 或 `css` 覆盖后，全部对应工具类和组件会自动跟随。

## 使用情况概览

对 `packages/desktop/src/renderer` 中原始 `var()` 与 UnoCSS 引用的统计：

- **高频**：`--text-primary`、`--text-secondary`、`--color-text-1`、`--bg-1`、`--bg-2`、`--bg-3`、`--bg-base`、`--bg-6`、`--border-base`、`--fill`、`--primary`、`--success`、`--warning`、`--danger`
- **中频/特定场景**：`--aou-1..10`、`--bg-4/5/8/9/10`、`--bg-hover`、`--bg-active`、消息/工作区背景、品牌 Token、`--inverse`、`--dialog-fill-0`、`--text-white`、`--text-disabled`、`--border-light`、`--fill-white-to-black`、`--color-guid-agent-bar`
- **当前未使用，待清理**：`--info`、`--text-0`、`--border-special`

主题作者只需设置与目标表面相关的 Token；未设置项自动回退到基底值。

## 编写主题

结构化 Token 主题：

```json
{
  "id": "violet",
  "name": "Violet",
  "appearance": "light",
  "builtin": false,
  "created_at": 0,
  "updated_at": 0,
  "tokens": {
    "--primary": "#7c3aed",
    "--bg-1": "#faf5ff",
    "--text-primary": "#2e1065",
    "--color-primary": "#7c3aed"
  }
}
```

CSS 主题适用于字体、背景图片和伪元素等扩展场景：

```json
{
  "id": "my-skin",
  "name": "My Skin",
  "appearance": "dark",
  "builtin": false,
  "created_at": 0,
  "updated_at": 0,
  "css": ":root{ --primary: #ff85a2; } body{ font-family: 'Varela Round'; }"
}
```

用户在“设置 → 外观 → 手动添加”创建的主题始终使用 CSS 方式，不提供 `tokens`。
