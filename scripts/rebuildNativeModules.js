/**
 * 原生模块统一重建工具。
 *
 * 所有构建工具均从项目依赖和锁文件解析，禁止在发布过程中临时下载工具。
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

/**
 * 从项目依赖中解析固定版本的命令行入口。
 */
function resolveToolEntry(projectRoot, toolName) {
  try {
    if (toolName === 'prebuild-install') {
      return require.resolve('prebuild-install/bin.js', { paths: [projectRoot] });
    }
    if (toolName === 'electron-rebuild') {
      const mainEntry = require.resolve('@electron/rebuild', { paths: [projectRoot] });
      const cliEntry = path.join(path.dirname(mainEntry), 'cli.js');
      if (fs.existsSync(cliEntry)) {
        return cliEntry;
      }
    }
  } catch (error) {
    throw new Error(
      `缺少锁定的原生构建工具 ${toolName}。请先运行 bun install --frozen-lockfile。原始错误：${error.message}`
    );
  }
  throw new Error(`无法从项目依赖中解析原生构建工具 ${toolName}`);
}

/**
 * 规范化架构名称。
 */
function normalizeArch(arch) {
  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'ia32',
    armv7l: 'arm',
  };
  return archMap[arch] || arch;
}

/**
 * 根据目标平台确定需要重建的模块。
 */
function getModulesToRebuild(platform) {
  // 各平台均使用项目自带的 @lydell/node-pty-* 预构建文件，仅重建 better-sqlite3。
  if (platform === 'win32' || platform === 'windows') {
    return ['better-sqlite3'];
  } else if (platform === 'linux') {
    return ['better-sqlite3'];
  }
  // macOS 同样只重建 better-sqlite3。
  return ['better-sqlite3'];
}

/**
 * 构造原生模块编译环境变量。
 */
function buildEnvironment(platform, targetArch, electronVersion) {
  const env = {
    ...process.env,
    npm_config_arch: targetArch,
    npm_config_target_arch: targetArch,
    npm_config_build_from_source: 'true',
    npm_config_runtime: 'electron',
    npm_config_disturl: 'https://electronjs.org/headers',
    npm_config_target: electronVersion,
  };

  // Windows 编译环境。
  if (platform === 'win32' || platform === 'windows') {
    env.MSVS_VERSION = '2022';
    env.GYP_MSVS_VERSION = '2022';
    env.WindowsTargetPlatformVersion = '10.0.19041.0';
    env._WIN32_WINNT = '0x0A00';
  }

  return env;
}

/**
 * 使用锁文件内的 electron-rebuild 重建原生模块。
 *
 * @param {Object} options
 * @param {string} options.platform - 平台名称（win32、darwin、linux）
 * @param {string} options.arch - 目标架构
 * @param {string} options.electronVersion - Electron 版本
 * @param {string} options.cwd - 项目根目录
 * @param {string[]} [options.modules] - 需要重建的模块
 */
function rebuildWithElectronRebuild(options) {
  const {
    platform,
    arch,
    electronVersion,
    cwd = path.resolve(__dirname, '..'),
    modules = getModulesToRebuild(platform),
  } = options;

  const targetArch = normalizeArch(arch);
  const env = buildEnvironment(platform, targetArch, electronVersion);

  const rebuildCli = resolveToolEntry(cwd, 'electron-rebuild');
  const rebuildArgs = [
    rebuildCli,
    '--only',
    modules.join(','),
    '--force',
    '--arch',
    targetArch,
    '--version',
    electronVersion,
  ];
  console.log(`正在运行锁定工具：${process.execPath} ${rebuildArgs.join(' ')}`);
  execFileSync(process.execPath, rebuildArgs, {
    stdio: 'inherit',
    cwd,
    env,
  });
}

/**
 * 判断是否支持从源码跨架构编译。
 */
function canCrossCompileFromSource(buildArch, targetArch, platform) {
  // macOS 可在 x64 与 arm64 之间交叉编译。
  if (platform === 'darwin') {
    return true;
  }

  // Windows x64 在本机工具链完整时可编译 arm64。
  if (platform === 'win32' && buildArch === 'x64' && targetArch === 'arm64') {
    return true;
  }

  // Linux 缺少目标工具链时不能可靠地从源码跨架构编译。
  return buildArch === targetArch;
}

/**
 * 优先用锁定的 prebuild-install 安装预构建文件，失败后回退到 electron-rebuild。
 *
 * @param {Object} options
 * @param {string} options.moduleName - 模块名
 * @param {string} options.moduleRoot - 模块目录
 * @param {string} options.platform - 目标平台
 * @param {string} options.arch - 目标架构
 * @param {string} options.electronVersion - Electron 版本
 * @param {string} [options.projectRoot] - 项目根目录
 * @param {boolean} [options.forceRebuild] - 是否跳过预构建并强制源码编译
 * @param {string} [options.buildArch] - 构建机架构
 */
function rebuildSingleModule(options) {
  const {
    moduleName,
    moduleRoot,
    platform,
    arch,
    electronVersion,
    projectRoot = path.resolve(__dirname, '..'),
    forceRebuild = false,
    buildArch = process.arch,
  } = options;

  const targetArch = normalizeArch(arch);
  const normalizedBuildArch = normalizeArch(buildArch);
  const isCrossCompile = normalizedBuildArch !== targetArch;

  const env = buildEnvironment(platform, targetArch, electronVersion);
  env.npm_config_platform = platform;
  env.npm_config_target_platform = platform;

  // Linux 跨架构构建必须使用预构建文件。
  const mustUsePrebuild = platform === 'linux' && isCrossCompile;

  if (mustUsePrebuild) {
    console.log(`     检测到 Linux 跨架构编译（${normalizedBuildArch} → ${targetArch}）`);

    // 优先复用模块已有的目标架构预构建文件。
    const prebuildsDir = path.join(moduleRoot, 'prebuilds', `${platform}-${targetArch}`);
    if (fs.existsSync(prebuildsDir)) {
      const files = fs.readdirSync(prebuildsDir);
      const hasNodeFile = files.some((f) => f.endsWith('.node'));
      if (hasNodeFile) {
        console.log(`     ✓ 已在 ${prebuildsDir} 找到预构建文件，跳过重建`);

        // 删除 build/ 与 bin/，防止 node-gyp-build 误加载其他架构文件。
        const buildDir = path.join(moduleRoot, 'build');
        if (fs.existsSync(buildDir)) {
          console.log('     正在删除 build/，强制使用 prebuilds/');
          fs.rmSync(buildDir, { recursive: true, force: true });
        }

        const binDir = path.join(moduleRoot, 'bin');
        if (fs.existsSync(binDir)) {
          console.log('     正在删除 bin/，强制使用 prebuilds/');
          fs.rmSync(binDir, { recursive: true, force: true });
        }

        return true;
      }
    }

    console.log('     未找到现有预构建文件，正在尝试 prebuild-install……');
  }

  // 优先尝试固定版本的 prebuild-install。
  if (!forceRebuild || mustUsePrebuild) {
    try {
      env.npm_config_build_from_source = 'false';
      const prebuildCli = resolveToolEntry(projectRoot, 'prebuild-install');
      const prebuildArgs = [
        prebuildCli,
        '--runtime=electron',
        `--target=${electronVersion}`,
        `--platform=${platform}`,
        `--arch=${targetArch}`,
        '--force',
      ];

      console.log(`     正在运行锁定工具：${process.execPath} ${prebuildArgs.join(' ')}`);
      execFileSync(process.execPath, prebuildArgs, {
        cwd: moduleRoot,
        env,
        stdio: 'inherit',
      });

      console.log('     ✓ prebuild-install 成功');
      return true;
    } catch (error) {
      if (mustUsePrebuild) {
        // Linux 跨架构时预构建失败即终止，禁止悄悄改走不可用的源码路径。
        console.error('     ✗ prebuild-install 失败，且不支持从源码跨架构编译');
        console.error(`     错误：${error.message}`);
        return false;
      }
      // 同架构构建可回退到源码重建。
      console.log('     prebuild-install 失败，正在回退到 electron-rebuild……');
    }
  }

  // 使用锁定版本的 electron-rebuild 从源码重建。
  if (!canCrossCompileFromSource(normalizedBuildArch, targetArch, platform)) {
    console.error(`     ✗ ${platform} 不支持从 ${normalizedBuildArch} 跨架构编译到 ${targetArch}`);
    return false;
  }

  try {
    env.npm_config_build_from_source = 'true';
    const rebuildCli = resolveToolEntry(projectRoot, 'electron-rebuild');
    const rebuildArgs = [
      rebuildCli,
      '--only',
      moduleName,
      '--force',
      `--arch=${targetArch}`,
      `--version=${electronVersion}`,
    ];

    console.log(`     正在运行锁定工具：${process.execPath} ${rebuildArgs.join(' ')}`);
    execFileSync(process.execPath, rebuildArgs, {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
    });
    return true;
  } catch (error) {
    console.error(`❌ 无法重建 ${moduleName}：`, error.message);
    return false;
  }
}

/**
 * 递归搜索目录中的 .node 文件。
 */
function findNodeFiles(dir, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) {
    return [];
  }

  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findNodeFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name.endsWith('.node')) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    // 权限错误不影响后续的统一校验。
  }

  return results;
}

/**
 * 验证原生模块二进制文件是否存在。
 */
function verifyModuleBinary(moduleRoot, moduleName) {
  const binaryPathsToCheck = {
    'better-sqlite3': [path.join(moduleRoot, 'build', 'Release', 'better_sqlite3.node')],
    'node-pty': [
      path.join(moduleRoot, 'build', 'Release', 'pty.node'),
      path.join(moduleRoot, 'build', 'Release', 'conpty.node'),
      path.join(moduleRoot, 'build', 'Release', 'conpty_console_list.node'),
    ],
  };

  const pathsToCheck = binaryPathsToCheck[moduleName] || [];

  // 先检查约定路径。
  for (const binaryPath of pathsToCheck) {
    if (fs.existsSync(binaryPath)) {
      console.log(`     调试：已在 ${binaryPath} 找到二进制文件`);
      return true;
    }
  }

  // 约定路径不存在时再递归搜索。
  console.log('     调试：预期位置没有二进制文件，正在递归搜索……');
  const foundFiles = findNodeFiles(moduleRoot);
  if (foundFiles.length > 0) {
    console.log('     调试：找到以下 .node 文件：');
    foundFiles.forEach((f) => console.log(`       - ${f}`));
    return true;
  }

  console.log(`     调试：${moduleRoot} 中未找到 .node 文件`);
  return false;
}

/**
 * 提供给 CI 与本地任务使用的确定性命令行入口。
 */
function runCli(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      module: { type: 'string' },
      'module-root': { type: 'string' },
      platform: { type: 'string' },
      arch: { type: 'string' },
      'electron-version': { type: 'string' },
      'project-root': { type: 'string', default: path.resolve(__dirname, '..') },
      'force-rebuild': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const required = ['module', 'module-root', 'platform', 'arch', 'electron-version'];
  const missing = required.filter((name) => !values[name]);
  if (missing.length > 0) {
    console.error(`缺少原生模块重建参数：${missing.join('、')}`);
    return 2;
  }

  const projectRoot = path.resolve(values['project-root']);
  const moduleRoot = path.resolve(projectRoot, values['module-root']);
  const moduleName = values.module;
  const success = rebuildSingleModule({
    moduleName,
    moduleRoot,
    platform: values.platform,
    arch: values.arch,
    electronVersion: values['electron-version'],
    projectRoot,
    forceRebuild: values['force-rebuild'],
  });

  if (!success || !verifyModuleBinary(moduleRoot, moduleName)) {
    console.error(`原生模块 ${moduleName} 重建或校验失败`);
    return 1;
  }
  console.log(`原生模块 ${moduleName} 重建并校验通过`);
  return 0;
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  normalizeArch,
  getModulesToRebuild,
  buildEnvironment,
  rebuildWithElectronRebuild,
  rebuildSingleModule,
  verifyModuleBinary,
  canCrossCompileFromSource,
  resolveToolEntry,
  runCli,
};
