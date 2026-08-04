# 拉取请求

> 提交前请阅读 [CONTRIBUTING.md](../CONTRIBUTING.md)。不符合下列规则的 PR 可能会被关闭并要求重新提交。

## 变更说明

<!-- 清晰、简洁地说明此 PR 做了什么以及为什么要这样做。 -->

## 关联议题

<!-- 关联相关 Issue。合并后，“Closes #123”或“Fixes #123”会自动关闭对应 Issue。 -->

- Closes #

## 变更类型

- [ ] `fix` — 缺陷修复（不破坏现有功能）
- [ ] `feat` — 新功能（不破坏现有功能）
- [ ] `perf` — 性能改进
- [ ] `refactor` — 代码重构（不改变行为）
- [ ] 破坏性变更（会影响现有功能的修复或功能）
- [ ] `docs` — 文档更新

## 原子 PR 检查（规则 1）

- [ ] 此 PR 只包含**一个**无法继续拆分的功能或缺陷修复
- [ ] PR 标题遵循 Conventional Commits 格式：`<type>(<scope>): <subject>`（英文）

## 本地检查（规则 3）

<!-- 推送前运行这些检查；任一失败都会被 CI 拒绝。 -->

- [ ] `bun run format` — 格式化通过
- [ ] `bun run lint` — 无 lint 错误（未修改 `.ts`/`.tsx` 时可跳过）
- [ ] `bunx tsc --noEmit` — 无类型错误（未修改 `.ts`/`.tsx` 时可跳过）
- [ ] `bunx vitest run` — 测试通过
- [ ] i18n 验证通过（`bun run i18n:types` + `node scripts/check-i18n.js`）；修改 `packages/desktop/src/renderer/`、语言包或 i18n 配置时必选，否则不适用
- [ ] 新增或修改的用户可见文案使用 i18n 键，没有硬编码

## 运行验证

<!-- 实际在哪些平台运行并验证过？ -->

- [ ] 已在 macOS 验证
- [ ] 已在 Windows 验证
- [ ] 已在 Linux 验证
- [ ] 已完成代码自审

## 截图

<!-- 如适用，请添加截图或录屏说明变更。 -->

## 补充信息

<!-- 在此补充其他背景信息。 -->

---

<!-- Commit 和 PR 标题不得包含 AI 签名（如 Co-Authored-By、Generated with 等）。 -->

**感谢你为 TjuaeUI 作出贡献！🎉**
