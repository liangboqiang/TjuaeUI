# CI/CD 配置指南

TjuaeUI 使用 GitHub Actions 完成代码门禁、多平台构建、Web CLI 打包和草稿 Release 创建。GitHub Releases 是唯一发布源。工作流文件本身是行为的单一事实来源；调整流程时必须同步更新本文。

## 工作流

| 文件                    | 触发方式                                       | 作用                                       |
| ----------------------- | ---------------------------------------------- | ------------------------------------------ |
| `pr-checks.yml`         | 发往 `main` 或 `dev` 的非纯文档 PR；可手动触发 | 代码质量、测试、构建与安装验证             |
| `pr-checks-docs.yml`    | 纯文档 PR                                      | 文档相关门禁                               |
| `build-and-release.yml` | 推送到 `dev` 或推送正式 Tag                    | 多平台构建、Web CLI 打包、创建草稿 Release |
| `_build-reusable.yml`   | 由其他工作流调用                               | 桌面端代码质量和构建矩阵                   |
| `build-manual.yml`      | 手动触发                                       | 指定分支、平台和可选 TjuaeCore 构建运行    |
| `pack-web-cli.yml`      | 调用或手动触发                                 | 构建并打包 Web CLI                         |
| `pr-e2e-artifacts.yml`  | 手动触发                                       | 生成 Linux E2E 测试产物                    |
| `issue-triage.yml`      | 新建 Issue                                     | 按模块添加标签并分配负责人                 |

## 发布流程

### 开发版

1. 更新 `package.json` 中的版本及相关变更记录。
2. 完成本地门禁：

   ```bash
   just check
   just test
   ```

3. 将经过审查的变更合并或推送到 `dev`。
4. `build-and-release.yml` 运行代码质量检查，构建桌面端和 Web CLI，并创建开发 Tag。
5. 工作流创建草稿预发布；维护者检查产物和自动生成的说明后手动发布。

### 正式版

1. 确认版本号、变更记录和各仓库依赖版本已锁定。
2. 创建并推送正式 Tag，例如：

   ```bash
   git tag v1.2.3
   just push origin v1.2.3
   ```

3. `build-and-release.yml` 构建全平台产物并创建草稿 Release。
4. 维护者核对签名、安装、启动、自动更新元数据和哈希后发布 Release。
5. 发布后由用户和客户端直接从 GitHub Releases 获取产物，不再创建额外镜像。

工作流生成的是草稿 Release，不会自动向用户发布。

## 手动构建

在 GitHub 仓库的 Actions 页面选择“🔨 手动构建”，配置：

- `branch`：要构建的分支或 ref；
- `platform`：单个平台或全部平台；
- `skip_code_quality`：仅调试时跳过代码质量检查；
- `tjuaecore_run_id`：可选，改用某次 TjuaeCore 手动构建产物，而不是锁定版本。

发布候选构建不应跳过代码质量检查。

## 必需的机密变量

具体机密变量是否必需取决于目标平台和工作流。

仓库检出、标签推送、工作流重跑、公开依赖下载与 Release 创建统一使用 GitHub 自动提供的 `github.token`，不要求自定义 GitHub PAT。

### macOS 签名与公证

- `BUILD_CERTIFICATE_BASE64`
- `P12_PASSWORD`
- electron-builder 公证所需的 Apple 凭据

未配置证书时可生成未签名应用，但不能作为正式 macOS 发布物。

## 权限与环境

- 工作流优先使用 GitHub 自动提供的 `GITHUB_TOKEN`，并为每个任务声明最小权限。
- 开发版与正式版分别使用 `dev-release` 和 `release` 环境。
- 建议为 `release` 环境配置人工审批和受保护分支规则。
- 不要在仓库中保存 Personal Access Token、证书或云端长期凭据。

## 构建产物

- macOS：`.dmg`、更新元数据和校验文件。
- Windows：NSIS `.exe`、可选 `.msi`、更新元数据和校验文件。
- Linux：`.deb`、压缩包或配置中声明的其他安装格式。
- Web：Web CLI 包及安装脚本。

实际产物以 `packages/desktop/electron-builder.yml`、构建脚本和工作流上传规则为准。

## 故障排查

### 构建依赖失败

1. 检查 `bun install --frozen-lockfile` 与 `postinstall` 日志。
2. 确认 Electron、原生模块和目标架构一致。
3. 在本地运行 `just preflight`、`just check` 和对应平台构建。

### TjuaeCore 资源缺失

检查根目录 `package.json` 中锁定的 TjuaeCore 版本、构建工作流的 `tjuaecore_run_id` 和准备资源步骤。发布前运行相关资源完整性测试。

### macOS 签名或公证失败

检查证书、密码、Apple 凭据和 runner 钥匙串日志。工作流可能保留已生成的 DMG 并标记公证警告，但公证失败的产物不能直接作为正式发布物。

### 发布创建失败

检查标签是否已存在、工作流的 `contents: write` 权限、环境审批状态以及构建产物下载步骤。

## 安全原则

1. 第三方 Action 固定到受信任版本，并定期升级。
2. 每个任务只授予所需权限。
3. Secret 只通过 GitHub Secrets 或 Environment 注入。
4. 日志不得打印 Token、证书、口令或云端账号标识。
5. 正式发布前验证安装、启动、卸载、自动更新和哈希。
