/**
 * TjuaeUI 安装后处理脚本。
 * 按运行环境安装或准备原生模块。
 */

const { execSync } = require('child_process');

// web-tree-sitter 已是 package.json 的直接依赖，无需再创建符号链接或复制文件。

function runPostInstall() {
  try {
    // 判断当前是否为持续集成环境。
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const electronVersion = require('../package.json').devDependencies.electron.replace(/^[~^]/, '');

    console.log(`运行环境：CI=${isCI}，Electron=${electronVersion}`);

    if (isCI) {
      // CI 使用预编译二进制；打包阶段会负责处理原生模块。
      console.log('检测到 CI 环境，跳过本地重建并使用预编译二进制');
      console.log('原生模块将在打包阶段统一处理');
    } else {
      // 本地开发环境使用 electron-builder 安装应用依赖。
      console.log('检测到本地环境，正在安装应用依赖');
      execSync('bunx electron-builder install-app-deps', {
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_build_from_source: 'true',
        },
      });
    }
  } catch (e) {
    console.error('安装后处理失败：', e.message);
    throw e;
  }
}

// 仅在直接执行本文件时运行。
if (require.main === module) {
  runPostInstall();
}

module.exports = runPostInstall;
