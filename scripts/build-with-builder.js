#!/usr/bin/env node

/**
 * TjuaeUI 统一构建脚本。
 * 协调 electron-vite 打包与 electron-builder 分发包生成。
 *
 * 功能：
 * - 增量构建：out/ 存在时可用 --skip-vite 跳过 Vite 编译
 * - 跳过原生模块重建：--skip-native
 * - 仅生成应用目录：--pack-only
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// DMG retry logic for macOS: detects DMG creation failures by checking artifacts
// (.app exists but .dmg missing) and retries only the DMG step using
// electron-builder --prepackaged with the .app path (not the parent directory).
// This preserves full DMG styling (window size, icon positions, background)
// Background: GitHub Actions macos-14 runners occasionally suffer from transient
// "Device not configured" hdiutil errors (electron-builder#8415, actions/runner-images#12323).
const DMG_RETRY_MAX = 3;
const DMG_RETRY_DELAY_SEC = 30;

// Incremental build: hash of source files to detect changes
const INCREMENTAL_CACHE_FILE = 'out/.build-hash';
const DEBUG_AUTO_UPDATE_CURRENT_VERSION_ENV = 'TJUAEUI_DEBUG_AUTO_UPDATE_CURRENT_VERSION';

function patchElectronBuilderNsisInstaller() {
  const rootDir = path.resolve(__dirname, '..');
  // Resolve app-builder-lib inside THIS repo first. require.resolve walks up
  // parent directories, so in a git worktree (whose bun install has no
  // top-level node_modules/app-builder-lib) it would escape to the main
  // checkout's copy and patch the wrong file.
  let appBuilderDir = '';
  const directDir = path.join(rootDir, 'node_modules', 'app-builder-lib');
  if (fs.existsSync(path.join(directDir, 'package.json'))) {
    appBuilderDir = directDir;
  } else {
    const bunModulesDir = path.join(rootDir, 'node_modules', '.bun');
    if (fs.existsSync(bunModulesDir)) {
      const candidates = fs
        .readdirSync(bunModulesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('app-builder-lib@'))
        .map((entry) => path.join(bunModulesDir, entry.name, 'node_modules', 'app-builder-lib'))
        .filter((candidate) => fs.existsSync(path.join(candidate, 'package.json')))
        .sort();
      appBuilderDir = candidates[0] || '';
    }
  }
  if (!appBuilderDir) {
    try {
      appBuilderDir = path.dirname(require.resolve('app-builder-lib/package.json'));
    } catch (error) {
      console.warn(`警告：无法解析 app-builder-lib，已跳过 NSIS 模板补丁：${error.message}`);
      return;
    }
  }

  const installUtilPath = path.join(appBuilderDir, 'templates', 'nsis', 'include', 'installUtil.nsh');
  if (!fs.existsSync(installUtilPath)) {
    console.warn(`警告：未找到 electron-builder NSIS installUtil.nsh：${installUtilPath}`);
    return;
  }

  const original = fs.readFileSync(installUtilPath, 'utf8');
  let patched = original;

  const retryPrompt = [
    '    ${if} $R5 > 5',
    '      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY OneMoreAttempt',
    '      Return',
    '    ${endIf}',
  ].join('\n');
  const retryHandoff = [
    '    ${if} $R5 > 5',
    '      DetailPrint `Previous uninstaller did not finish after retry limit; deferring to customUnInstallCheck.`',
    '      Return',
    '    ${endIf}',
  ].join('\n');

  if (patched.includes(retryPrompt)) {
    patched = patched.replace(retryPrompt, retryHandoff);
  } else if (!patched.includes(retryHandoff)) {
    throw new Error('electron-builder NSIS 卸载重试提示模板已变化，请更新 patchElectronBuilderNsisInstaller。');
  }

  const oneMoreAttemptLabel = '  OneMoreAttempt:\n';
  if (patched.includes(oneMoreAttemptLabel)) {
    patched = patched.replace(oneMoreAttemptLabel, '');
  }

  const copiedUninstallerExec = `ExecWait '"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 _?=$installationDir' $R0`;
  const copiedUninstallerExecWithLog = `ExecWait '"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 --installer-log="$TjuaeUISessionLogPath" --installer-session="$TjuaeUISessionId" _?=$installationDir' $R0`;
  if (patched.includes(copiedUninstallerExec)) {
    patched = patched.replace(copiedUninstallerExec, copiedUninstallerExecWithLog);
  } else if (
    patched.includes(
      `ExecWait '"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 --installer-log="$TjuaeUISessionLogPath" _?=$installationDir' $R0`
    )
  ) {
    patched = patched.replace(
      `ExecWait '"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 --installer-log="$TjuaeUISessionLogPath" _?=$installationDir' $R0`,
      copiedUninstallerExecWithLog
    );
  } else if (!patched.includes(copiedUninstallerExecWithLog)) {
    throw new Error('electron-builder 的复制卸载器 ExecWait 模板已变化，请更新 patchElectronBuilderNsisInstaller。');
  }

  const uninstallerCopySource = [
    '  StrCpy $uninstallerFileNameTemp "$PLUGINSDIR\\old-uninstaller.exe"',
    '  !insertmacro copyFile "$uninstallerFileName" "$uninstallerFileNameTemp"',
  ].join('\n');
  const bundledUninstallerOverride = [
    '  ${if} ${FileExists} "$PLUGINSDIR\\TjuaeUI-fixed-uninstaller.exe"',
    '    DetailPrint `TjuaeUI-bundled-uninstaller override source.`',
    '    StrCpy $uninstallerFileName "$PLUGINSDIR\\TjuaeUI-fixed-uninstaller.exe"',
    '  ${endIf}',
  ].join('\n');
  const bundledUninstallerCopySource = [
    bundledUninstallerOverride,
    '',
    '  StrCpy $uninstallerFileNameTemp "$PLUGINSDIR\\old-uninstaller.exe"',
    '  !insertmacro copyFile "$uninstallerFileName" "$uninstallerFileNameTemp"',
  ].join('\n');

  while (patched.includes(`${bundledUninstallerOverride}\n\n${bundledUninstallerOverride}`)) {
    patched = patched.replace(
      `${bundledUninstallerOverride}\n\n${bundledUninstallerOverride}`,
      bundledUninstallerOverride
    );
  }

  if (patched.includes(bundledUninstallerOverride)) {
    // Already patched.
  } else if (patched.includes(uninstallerCopySource)) {
    patched = patched.replace(uninstallerCopySource, bundledUninstallerCopySource);
  } else {
    throw new Error('electron-builder 的旧卸载器复制模板已变化，请更新 patchElectronBuilderNsisInstaller。');
  }

  const inPlaceUninstallerExec = `ExecWait '"$uninstallerFileName" /S /KEEP_APP_DATA $0 _?=$installationDir' $R0`;
  const inPlaceUninstallerExecWithLog = `ExecWait '"$uninstallerFileName" /S /KEEP_APP_DATA $0 --installer-log="$TjuaeUISessionLogPath" --installer-session="$TjuaeUISessionId" _?=$installationDir' $R0`;
  if (patched.includes(inPlaceUninstallerExec)) {
    patched = patched.replace(inPlaceUninstallerExec, inPlaceUninstallerExecWithLog);
  } else if (
    patched.includes(
      `ExecWait '"$uninstallerFileName" /S /KEEP_APP_DATA $0 --installer-log="$TjuaeUISessionLogPath" _?=$installationDir' $R0`
    )
  ) {
    patched = patched.replace(
      `ExecWait '"$uninstallerFileName" /S /KEEP_APP_DATA $0 --installer-log="$TjuaeUISessionLogPath" _?=$installationDir' $R0`,
      inPlaceUninstallerExecWithLog
    );
  } else if (!patched.includes(inPlaceUninstallerExecWithLog)) {
    throw new Error('electron-builder 的原位卸载器 ExecWait 模板已变化，请更新 patchElectronBuilderNsisInstaller。');
  }

  if (patched !== original) {
    fs.writeFileSync(installUtilPath, patched);
    console.log('已修补 electron-builder NSIS 卸载失败交接流程。');
  }
}

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === '.git') continue;
      walkFiles(fullPath, acc);
    } else if (entry.isFile()) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function computeSourceHash() {
  const hash = crypto.createHash('md5');
  const rootDir = path.resolve(__dirname, '..');
  const filesToHash = [
    'package.json',
    'package-lock.json',
    'bun.lock',
    'tsconfig.json',
    'packages/desktop/electron.vite.config.ts',
    'packages/desktop/electron-builder.yml',
    'justfile',
  ];

  for (const file of filesToHash) {
    const filePath = path.resolve(rootDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      hash.update(file + ':');
      hash.update(content);
    }
  }

  const hashDirs = ['packages/desktop/src', 'packages', 'public', 'scripts'];
  for (const dir of hashDirs) {
    const dirPath = path.resolve(rootDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = walkFiles(dirPath)
      .map((file) => path.relative(rootDir, file).replace(/\\/g, '/'))
      .sort();

    for (const relPath of files) {
      const absolutePath = path.resolve(rootDir, relPath);
      const stat = fs.statSync(absolutePath);
      hash.update(relPath + ':');
      hash.update(String(stat.size));
      hash.update(String(stat.mtimeMs));
    }
  }

  return hash.digest('hex');
}

function loadCachedHash() {
  try {
    const cacheFile = path.resolve(__dirname, '..', INCREMENTAL_CACHE_FILE);
    if (fs.existsSync(cacheFile)) {
      return fs.readFileSync(cacheFile, 'utf8').trim();
    }
  } catch {}
  return null;
}

function saveCurrentHash(hash) {
  try {
    const cacheFile = path.resolve(__dirname, '..', INCREMENTAL_CACHE_FILE);
    const viteDir = path.dirname(cacheFile);
    if (!fs.existsSync(viteDir)) {
      fs.mkdirSync(viteDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, hash);
  } catch {}
}

function viteBuildExists() {
  const outDir = path.resolve(__dirname, '../out');
  const mainDir = path.join(outDir, 'main');
  const rendererDir = path.join(outDir, 'renderer');

  return (
    fs.existsSync(path.join(mainDir, 'index.js')) &&
    fs.existsSync(path.join(outDir, 'preload', 'index.js')) &&
    validateRendererBuildOutput(rendererDir).valid
  );
}

function collectHtmlAssetRefs(html, htmlDirRelative) {
  const refs = [];
  const attrRe = /\b(?:src|href)=["']([^"']+)["']/g;
  for (const match of html.matchAll(attrRe)) {
    const rawRef = match[1];
    if (!rawRef || rawRef.startsWith('http:') || rawRef.startsWith('https:') || rawRef.startsWith('data:')) continue;
    if (!rawRef.startsWith('./') && !rawRef.startsWith('../')) continue;

    const normalized = path
      .normalize(path.join(htmlDirRelative, rawRef.split(/[?#]/)[0]))
      .replace(/\\/g, '/')
      .replace(/^\.\//, '');
    if (normalized.startsWith('assets/')) {
      refs.push(normalized);
    }
  }
  return refs;
}

function walkHtmlFiles(dir, baseDir = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath, baseDir, acc);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      acc.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
      });
    }
  }
  return acc;
}

function validateRendererBuildOutput(rendererDir) {
  const problems = [];
  const indexHtmlPath = path.join(rendererDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    return { valid: false, problems: ['Renderer build output is incomplete: missing out/renderer/index.html'] };
  }

  const htmlFiles = walkHtmlFiles(rendererDir);
  if (htmlFiles.length === 0) {
    return { valid: false, problems: ['Renderer build output is incomplete: no HTML files under out/renderer'] };
  }

  const assetRefs = new Set();
  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile.fullPath, 'utf8');
    if (/src=["'][^"']*\.tsx(?:[?#][^"']*)?["']/.test(html)) {
      problems.push(`渲染进程构建输出不完整：${htmlFile.relativePath} 仍引用 TypeScript 源码`);
    }

    const htmlDirRelative = path.dirname(htmlFile.relativePath);
    const baseRelative = htmlDirRelative === '.' ? '' : htmlDirRelative;
    for (const ref of collectHtmlAssetRefs(html, baseRelative)) {
      assetRefs.add(ref);
    }
  }

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  if (!/<div\s+id=["']root["']/.test(indexHtml)) {
    problems.push('渲染进程构建输出不完整：index.html 缺少 #root');
  }
  if (!/<script\b[^>]*type=["']module["'][^>]*\bsrc=["']\.\/assets\/[^"']+\.js["']/.test(indexHtml)) {
    problems.push('渲染进程构建输出不完整：index.html 没有打包后的模块脚本');
  }

  if (assetRefs.size === 0) {
    problems.push('渲染进程构建输出不完整：未找到打包后的渲染资源引用');
  }

  for (const ref of [...assetRefs].sort()) {
    if (!fs.existsSync(path.join(rendererDir, ref))) {
      problems.push(`渲染进程构建输出不完整：缺少引用的资源 ${ref}`);
    }
  }

  return { valid: problems.length === 0, problems };
}

function validateViteBuildOutput() {
  const outDir = path.resolve(__dirname, '../out');
  const problems = [];

  for (const relPath of ['main/index.js', 'preload/index.js']) {
    if (!fs.existsSync(path.join(outDir, relPath))) {
      problems.push(`Vite 构建输出不完整：缺少 out/${relPath}`);
    }
  }

  const rendererValidation = validateRendererBuildOutput(path.join(outDir, 'renderer'));
  problems.push(...rendererValidation.problems);

  return { valid: problems.length === 0, problems };
}

function shouldSkipViteBuild(skipViteFlag, forceFlag) {
  if (forceFlag) return false;
  if (skipViteFlag) return true;

  // Auto-detect: skip if build exists and hash matches
  const currentHash = computeSourceHash();
  const cachedHash = loadCachedHash();

  if (cachedHash && currentHash === cachedHash && viteBuildExists()) {
    console.log('📦 增量构建：Vite 输出未变化，已跳过编译');
    return true;
  }

  if (cachedHash && currentHash === cachedHash) {
    const validation = validateViteBuildOutput();
    if (!validation.valid) {
      console.warn('增量构建缓存匹配，但输出不完整；将重新构建。');
      for (const problem of validation.problems.slice(0, 5)) {
        console.warn(`   ${problem}`);
      }
    }
  }

  return false;
}

function cleanupDiskImages() {
  try {
    // Detach all mounted disk images that may block subsequent DMG creation:
    // hdiutil info → grep device paths → force detach each
    const result = spawnSync(
      'sh',
      [
        '-c',
        "hdiutil info 2>/dev/null | grep /dev/disk | awk '{print $1}' | xargs -I {} hdiutil detach {} -force 2>/dev/null",
      ],
      { stdio: 'ignore' }
    );
    if (result.status !== 0) {
      console.log(`   ℹ️  磁盘镜像清理退出码：${result.status}`);
    }
    return result.status === 0;
  } catch (error) {
    console.log(`   ℹ️  磁盘镜像清理失败：${error.message}`);
    return false;
  }
}

// Find the .app directory from electron-builder output
function findAppDir(outDir) {
  const candidates = ['mac', 'mac-arm64', 'mac-x64', 'mac-universal'];
  for (const dir of candidates) {
    const fullPath = path.join(outDir, dir);
    if (fs.existsSync(fullPath)) {
      const hasApp = fs.readdirSync(fullPath).some((f) => f.endsWith('.app'));
      if (hasApp) return fullPath;
    }
  }
  return null;
}

// Check if DMG exists in output directory
function dmgExists(outDir) {
  try {
    return fs.readdirSync(outDir).some((f) => f.endsWith('.dmg'));
  } catch {
    return false;
  }
}

function tryRemoveDir(targetDir) {
  if (!fs.existsSync(targetDir)) return true;
  try {
    fs.rmSync(targetDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 300,
    });
    return true;
  } catch (error) {
    console.log(`❌ 无法删除 ${targetDir}：${error.message}`);
    return false;
  }
}

function isProcessRunningWindows(imageName) {
  if (process.platform !== 'win32') return false;
  try {
    const result = execSync(`tasklist /FI "IMAGENAME eq ${imageName}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.toString().toLowerCase().includes(imageName.toLowerCase());
  } catch {
    return false;
  }
}

function killWindowsProcesses(imageNames) {
  if (process.platform !== 'win32') return;
  for (const name of imageNames) {
    try {
      execSync(`taskkill /F /IM ${name}`, { stdio: 'ignore' });
    } catch {}
  }
}

function formatExecError(error) {
  return [error?.message, error?.stdout?.toString?.(), error?.stderr?.toString?.()].filter(Boolean).join('\n').trim();
}

function isValidPackageVersion(value) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
    value
  );
}

function applyDebugAutoUpdateVersionOverride(packageJsonPath) {
  const debugAutoUpdateCurrentVersion = process.env[DEBUG_AUTO_UPDATE_CURRENT_VERSION_ENV]?.trim();
  if (!debugAutoUpdateCurrentVersion) {
    return () => {};
  }
  if (!isValidPackageVersion(debugAutoUpdateCurrentVersion)) {
    throw new Error(`${DEBUG_AUTO_UPDATE_CURRENT_VERSION_ENV} 必须是有效的语义化版本`);
  }

  const originalPackageJsonText = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(originalPackageJsonText);
  const originalPackageVersion = packageJson.version;
  if (originalPackageVersion === debugAutoUpdateCurrentVersion) {
    console.log(`调试自动更新构建版本已是 ${debugAutoUpdateCurrentVersion}`);
    return () => {};
  }

  packageJson.version = debugAutoUpdateCurrentVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`调试自动更新构建版本覆盖：${originalPackageVersion} -> ${debugAutoUpdateCurrentVersion}`);

  return () => {
    if (fs.readFileSync(packageJsonPath, 'utf8') !== originalPackageJsonText) {
      fs.writeFileSync(packageJsonPath, originalPackageJsonText);
      console.log(`已将 package.json 版本恢复为 ${originalPackageVersion}`);
    }
  };
}

// Create macOS distributables using electron-builder --prepackaged with .app path.
// This preserves DMG styling and still emits the zip required by MacUpdater.
function createMacArtifactsWithPrepackaged(appDir, targetArch) {
  const appName = fs.readdirSync(appDir).find((f) => f.endsWith('.app'));
  if (!appName) throw new Error(`${appDir} 中未找到 .app`);
  const appPath = path.join(appDir, appName);

  execSync(
    `bunx electron-builder --config packages/desktop/electron-builder.yml --mac dmg zip --${targetArch} --prepackaged "${appPath}" --publish=never`,
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );
}

function buildWithDmgRetry(cmd, targetArch) {
  const isMac = process.platform === 'darwin';
  const outDir = path.resolve(__dirname, '../out');

  try {
    execSync(cmd, { stdio: 'inherit', shell: process.platform === 'win32' });
    return;
  } catch (error) {
    // On non-macOS or if .app doesn't exist, just throw
    const appDir = isMac ? findAppDir(outDir) : null;
    if (!appDir || dmgExists(outDir)) throw error;

    // .app exists but no .dmg → DMG creation failed
    console.log('\n🔄 创建 DMG 时构建失败（存在 .app，但缺少 .dmg）');
    console.log('   正在使用 --prepackaged 重试创建 macOS 分发包……');

    for (let attempt = 1; attempt <= DMG_RETRY_MAX; attempt++) {
      cleanupDiskImages();
      spawnSync('sleep', [String(DMG_RETRY_DELAY_SEC)]);

      try {
        console.log(`\n📀 第 ${attempt}/${DMG_RETRY_MAX} 次重试创建 DMG……`);
        createMacArtifactsWithPrepackaged(appDir, targetArch);
        console.log('✅ 重试后已成功创建 macOS 分发包');
        return;
      } catch (retryError) {
        console.log(`   ⚠️  第 ${attempt}/${DMG_RETRY_MAX} 次 DMG 重试失败`);
        cleanupDiskImages();
        if (attempt === DMG_RETRY_MAX) {
          console.log(`   ❌ 重试 ${DMG_RETRY_MAX} 次后仍无法创建 DMG`);
          throw retryError;
        }
      }
    }
  }
}

// Clean stale Windows packaging outputs from previous runs
function cleanupWindowsPackOutput() {
  const outDir = path.resolve(__dirname, '../out');
  if (!fs.existsSync(outDir)) return;

  const removed = [];
  const winUnpackedDirRe = /^win(?:-[a-z0-9]+)?-unpacked(?:\.tmp)?$/i;
  const winArtifactFileRe = /-win-[^.]+\.(?:exe|msi|zip|7z)$/i;

  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    const fullPath = path.join(outDir, entry.name);

    if (entry.isDirectory() && winUnpackedDirRe.test(entry.name)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      removed.push(entry.name);
      continue;
    }

    if (entry.isFile() && winArtifactFileRe.test(entry.name)) {
      fs.rmSync(fullPath, { force: true });
      removed.push(entry.name);
    }
  }

  if (removed.length > 0) {
    console.log(`🧹 已清理过期 Windows 输出：${removed.join(', ')}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const archList = ['x64', 'arm64', 'ia32', 'armv7l'];

// Check for special flags
const skipVite = args.includes('--skip-vite');
const skipNative = args.includes('--skip-native');
const packOnly = args.includes('--pack-only');
const forceBuild = args.includes('--force');

const builderArgs = args
  .filter((arg) => {
    // Filter out 'auto', architecture flags, and special flags
    if (arg === 'auto') return false;
    if (arg === '--skip-vite' || arg === '--skip-native' || arg === '--pack-only' || arg === '--force') return false;
    if (archList.includes(arg)) return false;
    if (arg.startsWith('--') && archList.includes(arg.slice(2))) return false;
    return true;
  })
  .join(' ');

// Get target architecture from electron-builder.yml
function getTargetArchFromConfig(platform) {
  try {
    const configPath = path.resolve(__dirname, '../packages/desktop/electron-builder.yml');
    const content = fs.readFileSync(configPath, 'utf8');

    const platformRegex = new RegExp(`^${platform}:\\s*$`, 'm');
    const platformMatch = content.match(platformRegex);
    if (!platformMatch) return null;

    const platformStartIndex = platformMatch.index;
    const afterPlatform = content.slice(platformStartIndex + platformMatch[0].length);
    const nextPlatformMatch = afterPlatform.match(/^[a-zA-Z][a-zA-Z0-9]*:/m);
    const platformBlock = nextPlatformMatch
      ? content.slice(platformStartIndex, platformStartIndex + platformMatch[0].length + nextPlatformMatch.index)
      : content.slice(platformStartIndex);

    const archMatch = platformBlock.match(/arch:\s*\[\s*([a-z0-9_]+)/i);
    return archMatch ? archMatch[1].trim() : null;
  } catch (error) {
    return null;
  }
}

// Determine target architecture
const buildMachineArch = process.arch;
let targetArch;
let multiArch = false;

// Check if multiple architectures are specified (support both --x64 and x64 formats)
const rawArchArgs = args
  .filter((arg) => {
    if (archList.includes(arg)) return true;
    if (arg.startsWith('--') && archList.includes(arg.slice(2))) return true;
    return false;
  })
  .map((arg) => (arg.startsWith('--') ? arg.slice(2) : arg));

// Remove duplicates to avoid treating "x64 --x64" as multiple architectures
const archArgs = [...new Set(rawArchArgs)];

if (archArgs.length > 1) {
  // Multiple unique architectures specified - let electron-builder handle it
  multiArch = true;
  targetArch = archArgs[0]; // Use first arch for webpack build
  console.log(`🔨 检测到多架构构建：${archArgs.join(', ')}`);
} else if (args[0] === 'auto') {
  if (archArgs.length === 1) {
    targetArch = archArgs[0];
  } else {
    // Auto mode: detect from electron-builder.yml
    let detectedPlatform = null;
    if (builderArgs.includes('--linux')) detectedPlatform = 'linux';
    else if (builderArgs.includes('--mac')) detectedPlatform = 'mac';
    else if (builderArgs.includes('--win')) detectedPlatform = 'win';

    const configArch = detectedPlatform ? getTargetArchFromConfig(detectedPlatform) : null;
    targetArch = configArch || buildMachineArch;
  }
} else {
  // Explicit architecture or default to build machine
  targetArch = archArgs[0] || buildMachineArch;
}

console.log(`🔨 构建目标架构：${targetArch}`);
console.log(`📋 构建器参数：${builderArgs || '（无）'}`);
if (skipVite) console.log('⚡ --skip-vite：输出存在时跳过 Vite 编译');
if (skipNative) console.log('⚡ --skip-native：跳过原生模块重建');
if (packOnly) console.log('⚡ --pack-only：跳过 electron-builder 分发包生成');
if (forceBuild) console.log('⚡ --force：强制完整重建');

const packageJsonPath = path.resolve(__dirname, '../package.json');
let restorePackageVersionOverride = () => {};
let buildFailed = false;

try {
  restorePackageVersionOverride = applyDebugAutoUpdateVersionOverride(packageJsonPath);

  // 1. Ensure package.json main entry is correct for electron-vite
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.main !== './out/main/index.js') {
    packageJson.main = './out/main/index.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  // 2. Check if we can skip Vite build (incremental build)
  const skipViteBuild = shouldSkipViteBuild(skipVite, forceBuild);

  if (!skipViteBuild) {
    // Run electron-vite to build all bundles (main + preload + renderer)
    console.log(`📦 正在构建 ${targetArch}……`);
    execSync(`bunx electron-vite build --config packages/desktop/electron.vite.config.ts`, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ELECTRON_BUILDER_ARCH: targetArch,
      },
    });

    // Save hash after successful build
    saveCurrentHash(computeSourceHash());
  } else {
    console.log('📦 正在使用缓存的 Vite 构建输出');
  }

  // Re-bundle builtin MCP server as a fully self-contained CJS bundle so it can
  // be executed by an external `node` process (no Electron ASAR support available).
  // electron-vite's externalizeDepsPlugin leaves npm packages as require() calls
  // which the standalone node process cannot resolve from inside app.asar.unpacked.
  // Uses a dedicated script (build-mcp-servers.js) to avoid shell-quoting issues
  // with special characters in esbuild --define values.
  console.log('📦 正在打包自包含的内置 MCP 服务……');
  execSync(`node "${path.join(__dirname, 'build-mcp-servers.js')}"`, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // 3. Verify electron-vite output
  const outDir = path.resolve(__dirname, '../out');
  if (!fs.existsSync(outDir)) {
    throw new Error('electron-vite 未生成 out/ 目录');
  }

  // 4. Validate output structure. This must reject source-only renderer shells;
  // otherwise local fast builds can package a white-screen app.
  const viteOutputValidation = validateViteBuildOutput();
  if (!viteOutputValidation.valid) {
    throw new Error(`Vite 构建输出不完整：\n${viteOutputValidation.problems.join('\n')}`);
  }

  // If --pack-only, skip electron-builder distributable creation
  if (packOnly) {
    console.log('✅ 应用目录已生成（已跳过分发包创建）');
    return;
  }

  // 5. Prepare tjuaecore binary (for packaged runtime usage)
  const { prepareTjuaeCore } = require('../packages/shared-scripts/src/prepare-tjuaecore.js');
  const { resolveTjuaeCoreVersion } = require('./resolveTjuaeCoreVersion.js');
  const projectRoot = path.resolve(__dirname, '..');
  prepareTjuaeCore({
    projectRoot,
    platform: process.platform,
    arch: targetArch,
    version: resolveTjuaeCoreVersion(projectRoot),
  });

  // 6. Prepare hub resources (index.json + extension zips for offline fallback)
  execSync('node scripts/prepareHubResources.js', { stdio: 'inherit', env: process.env });

  // 6. 运行 electron-builder 生成分发包；始终禁用隐式发布，发布由 CI 独立任务负责。
  const publishArg = '--publish=never';

  // 按环境设置压缩级别：CI 使用 9，本地使用 7 以加快 ASAR 打包。
  const isCI = process.env.CI === 'true';
  if (!process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL) {
    process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = isCI ? '9' : '7';
  }
  console.log(`📦 压缩级别：${process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL}（${isCI ? 'CI 构建' : '本地构建'}）`);

  // 根据模式添加架构标志。
  let archFlag = '';
  if (multiArch) {
    // 多架构模式：将全部架构标志传递给 electron-builder。
    archFlag = archArgs.map((arch) => `--${arch}`).join(' ');
    console.log(`🚀 正在为多个架构打包：${archArgs.join(', ')}……`);
  } else {
    // 单架构模式：使用已确定的目标架构。
    archFlag = `--${targetArch}`;
    console.log(`🚀 正在创建 ${targetArch} 分发包……`);
  }

  // 为 Windows 构建添加架构检测脚本，使用 .onVerifyInstDir 避免冲突。
  let nsisInclude = '';
  if (builderArgs.includes('--win') || builderArgs.includes('--all')) {
    if (!multiArch) {
      // 单架构构建：添加对应架构的检测脚本。
      if (targetArch === 'arm64') {
        const arm64Script = 'resources/windows/windows-installer-arm64.nsh';
        if (fs.existsSync(path.resolve(__dirname, '..', arm64Script))) {
          nsisInclude += ` --config.nsis.include="${arm64Script}"`;
          console.log('📋 正在加入 Windows ARM64 架构检查脚本');
        }
        nsisInclude += ' --config.nsis.useZip=true';
        console.log('📋 Windows ARM64 NSIS 安装器使用 ZIP 载荷');
      } else if (targetArch === 'x64') {
        const x64Script = 'resources/windows/windows-installer-x64.nsh';
        if (fs.existsSync(path.resolve(__dirname, '..', x64Script))) {
          nsisInclude += ` --config.nsis.include="${x64Script}"`;
          console.log('📋 正在加入 Windows x64 架构检查脚本');
        }
      }
    }
    // 多架构构建暂不支持架构检测脚本。
  }

  if (process.platform === 'win32' && builderArgs.includes('--win')) {
    const winUnpackedDir = path.join(outDir, 'win-unpacked');
    let cleaned = tryRemoveDir(winUnpackedDir);
    if (!cleaned) {
      const tjuaeRunning = isProcessRunningWindows('TjuaeUI.exe');
      const electronRunning = isProcessRunningWindows('electron.exe');
      if (tjuaeRunning || electronRunning) {
        console.log('⚠️  检测到正在运行的 TjuaeUI/Electron 进程，正在尝试关闭……');
        killWindowsProcesses(['TjuaeUI.exe', 'electron.exe']);
        cleaned = tryRemoveDir(winUnpackedDir);
        if (!cleaned) {
          console.log('⚠️  目录仍被锁定，请关闭所有 TjuaeUI/Electron 进程后重试。');
        }
      }
    }
  }

  const isWindowsBuild = builderArgs.includes('--win') || builderArgs.includes('--all');
  if (isWindowsBuild) {
    patchElectronBuilderNsisInstaller();
    cleanupWindowsPackOutput();
  }

  const builderCommand = `bunx electron-builder --config packages/desktop/electron-builder.yml ${builderArgs} ${archFlag} ${nsisInclude} ${publishArg}`;
  try {
    buildWithDmgRetry(builderCommand, targetArch);
  } catch (error) {
    const winExePath = path.join(outDir, 'win-unpacked', 'TjuaeUI.exe');
    const firstError = formatExecError(error);
    const canRetryWithoutExecutableEdit =
      process.platform === 'win32' && isWindowsBuild && process.env.CI !== 'true' && fs.existsSync(winExePath);

    if (!canRetryWithoutExecutableEdit) {
      throw error;
    }

    console.log('⚠️  已生成 TjuaeUI.exe，但 Windows 本地构建随后失败。');
    if (firstError) {
      console.log('   首次失败摘要：');
      console.log(
        firstError
          .split(/\r?\n/)
          .slice(0, 6)
          .map((line) => `   ${line}`)
          .join('\n')
      );
    }
    console.log('   正在使用 win.signAndEditExecutable=false 重试本地构建……');
    console.log('   此回退用于开发机上的临时 rcedit 或文件锁问题。');
    killWindowsProcesses(['TjuaeUI.exe', 'electron.exe']);
    cleanupWindowsPackOutput();

    try {
      buildWithDmgRetry(`${builderCommand} --config.win.signAndEditExecutable=false`, targetArch);
    } catch (retryError) {
      const retryFailure = formatExecError(retryError);
      throw new Error(
        [
          '使用 win.signAndEditExecutable=false 的 Windows 本地重试仍然失败。',
          '首次失败：',
          firstError || String(error),
          '重试失败：',
          retryFailure || String(retryError),
        ].join('\n')
      );
    }
  }

  console.log('✅ 构建完成！');
} catch (error) {
  buildFailed = true;
  console.error('❌ 构建失败：', error.message);
  process.exitCode = 1;
} finally {
  try {
    restorePackageVersionOverride();
  } catch (restoreError) {
    console.error('❌ 无法恢复 package.json 版本：', restoreError.message);
    if (!buildFailed) {
      process.exitCode = 1;
    }
  }
}
