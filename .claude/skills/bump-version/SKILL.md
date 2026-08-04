---
name: bump-version
description: 按“Tjuae 轻量资产开发与协作体系完整方案”准备和验证 CLI → Core → Hub → UI → 根仓的正式候选版本；本地流程不依赖 GitHub CLI。
---

# 准备 Tjuae 正式候选版本

本技能只负责可审计的候选版本准备和验收。除非用户明确授权，不创建提交、不推送、不打标签。
不得要求用户安装 `gh`、`just` 或任何第三方智能体 CLI；GitHub Actions 内置的发布工具不构成
桌面应用、本地运行时或市场依赖。

## 固定边界

- 发布顺序只能是 `TjuaeCLI → TjuaeCore → TjuaeHub → TjuaeUI → tjuae 根仓`。
- Core 必须固定 CLI 的完整 40 位提交；UI 必须固定 Core 版本标签和 Hub `dist` 的完整 40 位提交。
- Core 本地资产和 Hub 远程资产是两份资源库，不得在发布过程中合并为一个事实源。
- Hub 和 UI 不下载、安装、更新、缓存或分发第三方 CLI；引擎适配器只声明检测与连接契约。
- 不复用已经指向旧提交的版本标签，不使用可变分支代替不可变 pin。

## 第一步：读取真实状态

在根工作区运行：

```powershell
git status --short
git submodule status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-release-readiness.ps1 -Mode Candidate
```

门禁非零退出时，按 JSON 中的稳定错误码处理；不得把“本地测试通过”解释成“正式发布完成”。

## 第二步：完成开发门禁

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-all.ps1 -SkipUiBuild
```

必须获得 `All four-repository development gates passed.`。该门禁会临时使用本地 CLI 验证 Core，
结束后恢复 Core 的正式远端 CLI revision；不得把本地路径写入 `Cargo.lock`。

## 第三步：确定版本

破坏兼容的完整方案候选版本固定为：

| 仓库      | 版本    |
| --------- | ------- |
| TjuaeCLI  | `0.4.0` |
| TjuaeCore | `0.3.1` |
| TjuaeHub  | `0.2.0` |
| TjuaeUI   | `4.0.0` |

同步更新每仓的主清单、锁文件、变更日志和工作流示例。历史变更日志和用于测试解析器的旧版本
夹具保持历史含义，不做无语义的全局替换。

## 第四步：按不可变顺序发布

只有用户明确授权提交和推送后才执行以下状态转换：

1. **CLI**：提交并推送，通过远端门禁后创建 `v0.4.0`；记录完整提交 SHA。
2. **Core**：把全部 TjuaeCLI Git 依赖固定到该 SHA，更新锁文件，提交并推送，通过远端门禁后
   创建 `v0.3.1`，等待六平台 Release 产物和校验和完整。
3. **Hub**：提交并推送 `main`；等待 `build-assets.yml` 将 Index v2、原子 ZIP 和离线种子发布到
   `dist`，并创建 `dist-<main短SHA>` 标签。记录 `dist` 的完整 SHA，验证索引
   `metadata.sourceRevision` 等于 Hub main SHA。
4. **UI**：固定 `tjuaeCoreVersion=v0.3.1` 和 `tjuaeHubRef=<dist完整SHA>`，重新生成离线种子并
   验证安装包；提交并推送，通过门禁后创建 `v4.0.0`。
5. **根仓**：更新四个 gitlink 到上述已发布提交，提交并推送根仓。

本地只使用项目已经要求的 `git`、PowerShell、Cargo、Node/Bun 工具链；GitHub PR 可以通过网页
完成，市场资产发布由 Core 的 GitHub REST Device Flow 完成，二者都不要求本机 GitHub CLI。

## 第五步：正式验收

```powershell
$env:TJUAE_GITHUB_APP_CLIENT_ID = '<真实 GitHub App Client ID>'
$env:TJUAE_GITHUB_APP_INSTALLATION_URL = 'https://github.com/apps/<真实-slug>/installations/new'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-release-readiness.ps1 -Mode Published
```

随后必须验证：

- 独立干净机器离线冷启动成功，市场显示 9 个助手、1 个引擎适配器、6 个技能、1 个 MCP；
- 市场安装/同步/冲突/解除跟踪/卸载、四类配置/试跑/启停、Trace 和真实 GitHub PR 流程通过；
- 安装目录、用户目录和市场包均不存在被分发的第三方 CLI。

任一项缺少直接证据时，正式发布验收都必须保持阻断。代码签名和 macOS 公证是可选的公开
分发增强，不作为本方案的验收条件；如维护者以后启用，仍须通过工作流中的严格验证。
