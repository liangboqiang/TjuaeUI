<p align="center">
  <img src="./packages/desktop/src/renderer/assets/logos/brand/app.svg" alt="TjuaeUI" width="128">
</p>

# TjuaeUI

TjuaeUI 是 Tjuae 智能体平台的桌面端与 WebUI 客户端，为会话、工具、文件、扩展、定时任务以及受支持的第三方智能体提供跨平台统一界面。

[繁體中文](./docs/readme/readme_tw.md) · [日本語](./docs/readme/readme_jp.md) · [한국어](./docs/readme/readme_ko.md) · [Español](./docs/readme/readme_es.md) · [Português](./docs/readme/readme_pt.md) · [Türkçe](./docs/readme/readme_tr.md) · [Русский](./docs/readme/readme_ru.md) · [Українська](./docs/readme/readme_uk.md)

## 仓库边界

| 仓库                                                   | 职责                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| [TjuaeUI](https://github.com/liangboqiang/TjuaeUI)     | Electron 桌面应用、渲染进程、预加载桥接与 WebUI |
| [TjuaeCore](https://github.com/liangboqiang/TjuaeCore) | 本地后端服务与持久化应用能力                    |
| [TjuaeCLI](https://github.com/liangboqiang/TjuaeCLI)   | Rust 智能体 CLI 与可复用智能体 crates           |
| [TjuaeHub](https://github.com/liangboqiang/TjuaeHub)   | 扩展清单、Schema、索引与可分发扩展包            |

TjuaeUI 由主进程启动 TjuaeCore。渲染进程不会直接访问 Node.js API；所有特权操作都通过带类型约束的 preload IPC 桥接完成。扩展使用 `tjuae-extension.json` 和 TjuaeHub Schema。

## 技术栈

- TypeScript、React、Electron 与 electron-vite
- Bun workspaces 与 Node.js 22+
- Arco Design、IconPark、UnoCSS 与 CSS Modules
- Vitest 单元/集成测试与 Playwright 端到端测试
- SQLite 本地状态与带类型约束的 IPC 进程通信

## 开发

```bash
bun install --frozen-lockfile
bun run start
```

常用质量检查：

```bash
bun run lint
bun run format:check
bunx tsc --noEmit
bun run test
bun run i18n:types
node scripts/check-i18n.js
```

构建桌面应用：

```bash
bun run package
```

各平台安装包由 `dist:*` 脚本和 GitHub Actions 发布流程生成。

## 迁移策略

Tjuae 身份迁移采用明确的断代策略。当前代码、配置、环境变量、包名、协议和运行时路径只使用 Tjuae 命名，不提供旧产品别名或回退路径。

## 贡献与安全

修改代码前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全漏洞请通过仓库的[私密安全公告流程](https://github.com/liangboqiang/TjuaeUI/security/advisories/new)报告。

项目采用 [Apache License 2.0](./LICENSE)；必要的上游源码署名记录在 [UPSTREAM.md](./UPSTREAM.md)。
