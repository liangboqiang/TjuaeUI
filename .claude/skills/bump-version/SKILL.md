---
name: bump-version
description: 升级 TjuaeUI 版本时使用：查询 TjuaeCore Release、校验构建产物、更新 package.json、生成 CHANGELOG、创建分支与 PR、自动合并并发布标签。
---

# 升级版本

自动完成 TjuaeUI 发布准备：查询 TjuaeCore Release → 校验产物 → 更新版本 → 生成 CHANGELOG → 创建分支 → 创建 PR → 发布标签。

**用法：**`/bump-version [version] [flags]`

- `/bump-version`：自动将 patch 版本加 1，并使用最新 TjuaeCore
- `/bump-version 3.0.1`：指定 TjuaeUI 版本，并使用最新 TjuaeCore
- `/bump-version 3.0.1 --core v0.2.0`：同时指定两个版本
- `/bump-version --skip-core`：仅发布前端，不修改 `tjuaeCoreVersion`

## 工作流程

### 第 1 步：前置检查

```bash
git branch --show-current
git status --short
```

- **当前不在 `main`**：停止并提示“请切换到 main 后再运行 bump-version。”
- **工作区不干净**：停止并提示“存在未提交的变更，请先提交或暂存。”

### 第 2 步：拉取最新代码

```bash
git pull --rebase origin main
```

失败时停止并提示：“拉取最新代码失败，请先解决冲突或网络问题。”

### 第 3 步：确定 TjuaeUI 目标版本

读取 `package.json` 的 `version` 字段。

- **提供了版本参数**：直接使用
- **未提供版本参数**：解析 `major.minor.patch`，将 `patch` 加 1

显示：“正在升级 TjuaeUI：{current} → {target}”

### 第 4 步：查询最新 TjuaeCore Release

设置 `--skip-core` 时完全跳过本步骤。

```bash
gh release view --repo liangboqiang/TjuaeCore --json tagName,body
```

- 提供 `--core <version>` 时，查询指定 tag，而不是最新版本
- 显示 TjuaeCore 版本，并在继续前请求用户确认
- 同时读取 `package.json` 当前的 `tjuaeCoreVersion`；若已经与查询结果一致，应警告用户并询问继续还是改用 `--skip-core`

### 第 5 步：校验 TjuaeCore 构建产物

设置 `--skip-core` 时跳过。

```bash
gh release view <tag> --repo liangboqiang/TjuaeCore --json assets --jq '.assets[].name'
```

确认以下 7 个预期文件全部存在：

- `tjuaecore-<tag>-x86_64-unknown-linux-gnu.tar.gz`
- `tjuaecore-<tag>-aarch64-unknown-linux-gnu.tar.gz`
- `tjuaecore-<tag>-x86_64-apple-darwin.tar.gz`
- `tjuaecore-<tag>-aarch64-apple-darwin.tar.gz`
- `tjuaecore-<tag>-x86_64-pc-windows-msvc.zip`
- `tjuaecore-<tag>-aarch64-pc-windows-msvc.zip`
- `tjuaecore-checksums.txt`

有文件缺失时停止并提示：“TjuaeCore {tag} 缺少构建产物：{list}。请等待 CI 完成或检查构建失败原因。”

### 第 6 步：更新 `package.json`

使用编辑工具替换：

- `"version": "{current}"` → `"version": "{target}"`
- `"tjuaeCoreVersion": "{old}"` → `"tjuaeCoreVersion": "{new core tag}"`；设置 `--skip-core` 时不修改

### 第 7 步：生成 CHANGELOG 条目

#### 7a：确定上一个 tag

```bash
git describe --tags --abbrev=0
```

该命令返回最近的标签，例如 `v2.1.2`。

#### 7b：收集前端变更

```bash
git log v{previous}..HEAD --oneline --no-merges --format="%s"
```

- 只保留约定式提交类型：`feat`、`fix`、`refactor`、`perf`、`style`
- 排除匹配 `chore: bump version` 的提交
- 按类型分组为“新功能”“问题修复”“重构”“性能优化”“样式调整”
- 每项格式为：`- **范围：** 描述（#PR）`

#### 7c：收集 TjuaeCore 变更

解析第 4 步取得的 GitHub Release 说明；发布说明由版本标签工作流直接生成。将其整理为相同分组。

设置 `--skip-core` 时跳过。

#### 7d：组合并写入 `CHANGELOG.md`

如果根目录存在 `CHANGELOG.md`，先读取现有内容；否则从空内容开始。

将以下格式的新条目插入文件顶部：

```markdown
# 变更日志

## [{target}](https://github.com/liangboqiang/TjuaeUI/compare/v{previous}...v{target}) ({date YYYY-MM-DD})

### 桌面端

#### 问题修复

- **上传：** 切换会话时中止仍在进行的上传（#3019）

#### 新功能

- **思考过程：** 添加流式输出指示器（#3015）

### 核心服务（[{核心标签}](https://github.com/liangboqiang/TjuaeCore/releases/tag/{核心标签})）

#### 问题修复

- **ACP：** 加载用户 MCP 服务，并为空结束事件输出诊断信息（#327）

---
```

规则：

- 设置 `--skip-core` 时省略整个“核心服务”区块
- 自上一个标签以来没有桌面端提交时，在“桌面端”下写入 `_本次发布没有桌面端变更。_`
- 日期格式为 `YYYY-MM-DD`
- 顶级“变更日志”标题只能出现一次

### 第 8 步：质量检查

```bash
bun run identity:check
bun run lint
bun run format:check
bunx tsc --noEmit
bun run i18n:types
node scripts/check-i18n.js
git diff --exit-code
```

- **身份契约失败**：停止并移除旧品牌、推广或退役黑盒残留
- **lint 失败**：停止并提示“发现 lint 错误，请修复后再升级版本。”
- **format 失败**：先执行 `bun run format`，复查变更后重新运行门禁
- **tsc 失败**：停止并提示“发现 TypeScript 错误，请修复后再升级版本。”
- **国际化失败**：补齐翻译或提交生成后的类型文件，再重新运行门禁

### 第 9 步：运行测试

```bash
bunx vitest run
```

失败时停止并提示：“测试失败，请修复后再升级版本。”

### 第 10 步：创建分支、提交并推送

```bash
git checkout -b chore/bump-version-{target}
git add package.json CHANGELOG.md
git commit -m "chore(release): 升级到 {target} 并固定 tjuaecore {core tag}"
just push -u origin chore/bump-version-{target}
```

设置 `--skip-core` 时使用：

```bash
git commit -m "chore(release): 升级到 {target}"
```

### 第 11 步：创建 PR 并启用自动合并

```bash
gh pr create --base main \
  --title "chore(release): 升级到 {target}" \
  --body "<第 7 步生成的 CHANGELOG 条目>"
```

从输出中取得 PR 编号，然后启用 squash 自动合并：

```bash
gh pr merge {PR_NUMBER} --auto --squash
```

显示：“PR 已创建：{URL}。已启用自动合并；CI 通过后将自动合并。”

### 第 12 步：轮询合并状态

每 5 分钟检查一次 PR：

```bash
gh pr view {PR_NUMBER} --json state,mergedAt,mergeStateStatus
```

**判断逻辑：**

| `state`                                                          | 操作                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `MERGED`                                                         | 进入第 13 步                                                  |
| `CLOSED` 且未合并                                                | 停止并提示“PR 未合并即被关闭，请检查并确认后续操作。”         |
| `OPEN` 且 `mergeStateStatus: BLOCKED`，或 CI 连续 3 次检查仍失败 | 停止并提示“PR 合并被阻断（CI 失败或需要审查），请检查：{URL}” |
| 其他 `OPEN`                                                      | 等待 5 分钟后再次检查                                         |

**最长等待时间：**30 分钟（6 次检查）。30 分钟后仍未合并时提示：

> “PR 在 30 分钟后仍未合并，请检查状态：{URL}。合并后回复 `continue`，或回复 `abort` 停止。”

**只有发生该超时时才等待用户确认。**

### 第 13 步：清理并创建 tag

确认合并后（通过轮询或用户确认）：

```bash
git checkout main
git pull --rebase origin main
git branch -d chore/bump-version-{target}
```

检查远程分支是否仍存在：

```bash
git ls-remote --heads origin chore/bump-version-{target}
```

- 有输出：执行 `just push origin --delete chore/bump-version-{target}`
- 无输出：跳过

创建并推送 tag：

```bash
git tag v{target}
just push origin v{target}
```

等待 GitHub 识别 tag 推送，再获取触发的 workflow：

```bash
gh run list --workflow=build-and-release.yml --branch v{target} --limit 1 --json databaseId,url
```

显示：“tag v{target} 已创建并推送，Release 构建已触发。Action：{run URL}”

## 快速参考

```text
 1. 必须位于干净的 main
 2. git pull --rebase
 3. 确定 TjuaeUI 目标版本（patch + 1 或显式指定）
 4. 查询最新 TjuaeCore Release（或使用 --core / --skip-core）
 5. 校验 TjuaeCore 产物（7 个文件）
 6. 修改 package.json（version + tjuaeCoreVersion）
 7. 生成 CHANGELOG（前端 commit + TjuaeCore Release body）
 8. identity + lint + format + tsc + i18n
 9. vitest run
10. branch → commit → push
11. gh pr create → 启用自动合并（squash）
12. 每 5 分钟轮询，最多 30 分钟；失败时停止
13. 清理 → git tag → 推送 tag
```
