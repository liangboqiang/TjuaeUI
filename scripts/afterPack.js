const { Arch } = require('builder-util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  normalizeArch,
  rebuildSingleModule,
  verifyModuleBinary,
  getModulesToRebuild,
} = require('./rebuildNativeModules');
const {
  verifyBundledTjuaeCoreResources,
} = require('../packages/shared-scripts/src/verify-bundled-tjuaecore-resources');

/**
 * electron-builder 的 afterPack 钩子。
 * 为跨架构构建重新编译原生模块。
 */

function resolveResourcesDir(electronPlatformName, appOutDir, packager) {
  if (electronPlatformName !== 'darwin') return path.join(appOutDir, 'resources');

  const appName = packager?.appInfo?.productFilename || 'TjuaeUI';
  return path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
}

function verifyBundledResources(resourcesDir, electronPlatformName, targetArch) {
  const result = verifyBundledTjuaeCoreResources({
    resourcesDir,
    electronPlatformName,
    targetArch,
  });

  if (result.missing.length > 0) {
    console.error(`   缺少内置资源：${result.missing.join(', ')}`);
    throw new Error(`打包后的应用缺少必要内置资源：${result.missing.join(', ')}`);
  }

  console.log(`   ✓ ${result.runtimeKey} 的内置资源验证通过（${result.checked.length} 项检查）`);
}

module.exports = async function afterPack(context) {
  const { arch, electronPlatformName, appOutDir, packager } = context;
  const targetArch = normalizeArch(typeof arch === 'string' ? arch : Arch[arch] || process.arch);
  const buildArch = normalizeArch(os.arch());

  console.log('\n🔧 afterPack 钩子已启动');
  console.log(`   平台：${electronPlatformName}，构建架构：${buildArch}，目标架构：${targetArch}`);

  const isCrossCompile = buildArch !== targetArch;
  const forceRebuild = process.env.FORCE_NATIVE_REBUILD === 'true';
  const needsSameArchRebuild = electronPlatformName === 'win32'; // Windows 需同架构重建以匹配 Electron ABI。
  // Linux 使用预编译二进制文件，避免引入 GLIBC 构建机依赖。

  const resourcesDir = resolveResourcesDir(electronPlatformName, appOutDir, packager);
  console.log(`   正在检查资源目录：${resourcesDir}`);
  if (fs.existsSync(resourcesDir)) {
    const resourcesContents = fs.readdirSync(resourcesDir);
    console.log(`   目录内容：${resourcesContents.join(', ')}`);

    const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
    if (fs.existsSync(unpackedDir)) {
      const unpackedContents = fs.readdirSync(unpackedDir);
      console.log(`   app.asar.unpacked 内容：${unpackedContents.join(', ')}`);

      const nodeModulesDir = path.join(unpackedDir, 'node_modules');
      if (fs.existsSync(nodeModulesDir)) {
        const modulesContents = fs.readdirSync(nodeModulesDir);
        console.log(`   node_modules 内容：${modulesContents.slice(0, 10).join(', ')}……`);
      } else {
        console.warn('   ⚠️  app.asar.unpacked 中未找到 node_modules');
      }
    } else {
      console.warn('   ⚠️  未找到 app.asar.unpacked');
    }

    verifyBundledResources(resourcesDir, electronPlatformName, targetArch);
  } else {
    throw new Error(`未找到资源目录：${resourcesDir}`);
  }

  if (!isCrossCompile && !needsSameArchRebuild && !forceRebuild) {
    console.log('   ✓ 架构相同，已跳过重建（设置 FORCE_NATIVE_REBUILD=true 可强制执行）\n');
    return;
  }

  // 跨架构构建必须重建原生模块，避免把 arm64 二进制误装入 x64 包。
  // 优先使用 prebuild-install，仅在必要时回退到源码编译。

  if (isCrossCompile) {
    console.log(`   ⚠️  检测到跨架构构建（${buildArch} → ${targetArch}），将重建原生模块`);
    if (electronPlatformName === 'darwin') {
      console.log('   💡 使用 prebuild-install 加速跨架构构建');
    }
  } else if (needsSameArchRebuild || forceRebuild) {
    console.log(`   ℹ️  正在按平台要求重建原生模块（强制=${forceRebuild}）`);
  }

  console.log(`\n🔧 正在检查原生模块（${electronPlatformName}-${targetArch}）……`);
  console.log(`   appOutDir: ${appOutDir}`);

  const electronVersion =
    packager?.info?.electronVersion ??
    packager?.config?.electronVersion ??
    require('../package.json').devDependencies?.electron?.replace(/^\D*/, '');

  const nodeModulesDir = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules');

  // 使用平台专属模块列表；Windows 因跨编译限制跳过 node-pty。
  const modulesToRebuild = getModulesToRebuild(electronPlatformName);
  console.log(`   待重建模块：${modulesToRebuild.join(', ')}`);

  // 跨架构构建前清理错误架构产物，防止 node-gyp-build 加载错误二进制文件。
  if (isCrossCompile) {
    console.log('\n🧹 正在清理错误架构的构建产物……');
    for (const moduleName of modulesToRebuild) {
      const moduleRoot = path.join(nodeModulesDir, moduleName);
      if (!fs.existsSync(moduleRoot)) continue;

      // 删除包含错误架构二进制文件的 build/。
      const buildDir = path.join(moduleRoot, 'build');
      if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true, force: true });
        console.log(`   ✓ 已删除 ${moduleName}/build/`);
      }

      // 删除可能包含错误架构二进制文件的 bin/。
      const binDir = path.join(moduleRoot, 'bin');
      if (fs.existsSync(binDir)) {
        fs.rmSync(binDir, { recursive: true, force: true });
        console.log(`   ✓ 已删除 ${moduleName}/bin/`);
      }
    }

    // 同时删除与目标架构相反的可选依赖包。
    const wrongArchSuffix = targetArch === 'arm64' ? 'x64' : 'arm64';
    console.log(`\n🧹 正在删除 ${wrongArchSuffix} 专属可选依赖（目标：${targetArch}）……`);

    if (fs.existsSync(nodeModulesDir)) {
      const allModules = fs.readdirSync(nodeModulesDir);
      for (const module of allModules) {
        const modulePath = path.join(nodeModulesDir, module);

        // 处理作用域包（例如 @lydell、@napi-rs）。
        if (module.startsWith('@') && fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
          const scopedPackages = fs.readdirSync(modulePath);
          for (const pkg of scopedPackages) {
            if (pkg.includes(`-${wrongArchSuffix}`) || pkg.includes(`-${electronPlatformName}-${wrongArchSuffix}`)) {
              const pkgPath = path.join(modulePath, pkg);
              if (fs.existsSync(pkgPath) && fs.statSync(pkgPath).isDirectory()) {
                fs.rmSync(pkgPath, { recursive: true, force: true });
                console.log(`   ✓ 已删除 ${module}/${pkg}`);
              }
            }
          }
        }
        // 处理普通包。
        else if (
          module.includes(`-${wrongArchSuffix}`) ||
          module.includes(`-${electronPlatformName}-${wrongArchSuffix}`)
        ) {
          if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
            fs.rmSync(modulePath, { recursive: true, force: true });
            console.log(`   ✓ 已删除 ${module}`);
          }
        }
      }
    }
  }

  const failedModules = [];

  for (const moduleName of modulesToRebuild) {
    const moduleRoot = path.join(nodeModulesDir, moduleName);

    if (!fs.existsSync(moduleRoot)) {
      console.warn(`   ⚠️  未找到 ${moduleName}，已跳过`);
      continue;
    }

    console.log(`   ✓ 已找到 ${moduleName}，正在为 ${targetArch} 重建……`);

    // Windows 优先使用更快且在 CI 中更稳定的 prebuild-install。
    const forceRebuildFromSource = false;

    const success = rebuildSingleModule({
      moduleName,
      moduleRoot,
      platform: electronPlatformName,
      arch: targetArch,
      electronVersion,
      projectRoot: path.resolve(__dirname, '..'),
      buildArch: buildArch,
      forceRebuild: forceRebuildFromSource,
    });

    if (success) {
      console.log('     ✓ 重建完成');
    } else {
      console.error('     ✗ 重建失败');
      failedModules.push(moduleName);
      continue;
    }

    const verified = verifyModuleBinary(moduleRoot, moduleName);
    if (verified) {
      console.log('     ✓ 二进制文件验证通过');
    } else {
      console.error('     ✗ 二进制文件验证失败');
      failedModules.push(moduleName);
    }

    console.log(''); // 模块之间保留空行。
  }

  if (failedModules.length > 0) {
    throw new Error(`无法为 ${electronPlatformName}-${targetArch} 重建模块：${failedModules.join(', ')}`);
  }

  console.log(`✅ ${targetArch} 的全部原生模块均已成功重建\n`);
};
