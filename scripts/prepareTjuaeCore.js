/**
 * prepare-tjuaecore 命令行包装器。
 *
 * 读取环境变量并调用共享模块。
 *
 * 版本解析顺序：
 *  1. TJUAEUI_BACKEND_RUN_ID（下载指定 TjuaeCore 工作流运行的构件）；
 *  2. TJUAEUI_BACKEND_VERSION（临时覆盖发行版本）；
 *  3. 仓库根 package.json 的 tjuaeCoreVersion（可复现构建所需的固定版本）。
 *
 * 环境变量：
 *  - TJUAEUI_BACKEND_RUN_ID：TjuaeCore 手动构建工作流运行编号；
 *  - TJUAEUI_BACKEND_VERSION：覆盖固定版本；
 *  - TJUAEUI_BACKEND_ARCH：目标架构，默认为 process.arch；
 *  - GH_TOKEN / GITHUB_TOKEN：GitHub API 令牌，用于提高请求限额。
 */

const path = require('path');
const { prepareTjuaeCore } = require('../packages/shared-scripts/src/prepare-tjuaecore.js');
const { resolveTjuaeCoreVersion } = require('./resolveTjuaeCoreVersion.js');

const projectRoot = path.resolve(__dirname, '..');
const platform = process.platform;
// 支持交叉编译：TJUAEUI_BACKEND_ARCH > npm_config_target_arch > process.arch。
const arch = process.env.TJUAEUI_BACKEND_ARCH || process.env.npm_config_target_arch || process.arch;
const version = resolveTjuaeCoreVersion(projectRoot);

try {
  prepareTjuaeCore({ projectRoot, platform, arch, version });
} catch (error) {
  console.error('❌ 准备 TjuaeCore 失败：', error.message);
  process.exit(1);
}

module.exports = function () {
  try {
    return prepareTjuaeCore({ projectRoot, platform, arch, version });
  } catch (error) {
    console.error('❌ 准备 TjuaeCore 失败：', error.message);
    throw error;
  }
};
