# TjuaeUI 文档

文档按读者的使用目的组织，而不是按文档类型堆放。

| 目录                            | 面向读者        | 内容                                                             |
| ------------------------------- | --------------- | ---------------------------------------------------------------- |
| [`guides/`](guides)             | 用户与运维人员  | 部署、测试和运行指南，包括服务器部署、WebUI、Hub 测试与 CDP 调试 |
| [`contributing/`](contributing) | 贡献者          | 开发环境、文件结构规范与 PR 自动化流程                           |
| [`architecture/`](architecture) | 工程师与架构师  | 系统架构总览、进程边界、仓库关系与运行时工作流                   |
| [`prds/`](prds)                 | 产品与研发团队  | 产品需求、功能设计及相关技术记录；未经负责人同意不得随意重组     |
| [`readme/`](readme)             | 不同语言的用户  | 根目录 `readme.md` 的其他语言版本                                |
| [`theming/`](theming)           | UI 与主题开发者 | 主题令牌和样式约束                                               |

## 快速入口

- 初次了解项目：从 [`architecture/overview.md`](architecture/overview.md) 开始。
- 搭建开发环境：阅读 [`contributing/development.md`](contributing/development.md)。
- 编写代码：仓库根目录的 [`AGENTS.md`](../AGENTS.md) 是代码风格、lint、格式化与提交规则入口。
- 部署服务器：阅读 [`guides/deploy-server.md`](guides/deploy-server.md)。

## 新文档放在哪里

| 内容类型                       | 目标目录                    |
| ------------------------------ | --------------------------- |
| 面向用户或运维人员的操作指南   | `guides/`                   |
| 贡献规范、流程或工具规则       | `contributing/`             |
| 系统或子系统设计、技术分析     | `architecture/`             |
| 由研发推动的功能需求或设计草案 | `prds/<feature-name>/`      |
| 产品团队维护的正式 PRD         | `prds/`（先与负责人协调）   |
| README 的其他语言版本          | `readme/readme_<locale>.md` |
