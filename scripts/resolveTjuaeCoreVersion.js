/**
 * 解析打包时必须下载的 tjuaecore 版本标签。
 *
 * 顺序：
 *   1. TJUAEUI_BACKEND_VERSION 环境变量（仅用于临时构建覆盖）
 *   2. 仓库根目录 package.json 的 tjuaeCoreVersion 固定值
 *
 * 本文件保持无依赖，因为安装项目依赖前就可能由打包脚本调用。
 */

const fs = require('fs');
const path = require('path');

function resolveTjuaeCoreVersion(projectRoot) {
  const envOverride = process.env.TJUAEUI_BACKEND_VERSION;
  if (envOverride && envOverride.trim()) {
    const normalizedOverride = envOverride.trim();
    if (normalizedOverride === 'latest') {
      throw new Error('TJUAEUI_BACKEND_VERSION 必须是固定版本标签，不能使用 latest');
    }
    return normalizedOverride;
  }

  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg && typeof pkg.tjuaeCoreVersion === 'string' && pkg.tjuaeCoreVersion.trim()) {
      const normalizedVersion = pkg.tjuaeCoreVersion.trim();
      if (normalizedVersion === 'latest') {
        throw new Error('package.json 的 tjuaeCoreVersion 必须是固定版本标签，不能使用 latest');
      }
      return normalizedVersion;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('不能使用 latest')) throw error;
  }

  throw new Error('package.json 缺少有效的 tjuaeCoreVersion，无法执行可复现打包');
}

module.exports = { resolveTjuaeCoreVersion };
