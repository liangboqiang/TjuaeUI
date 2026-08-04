/**
 * 为打包准备 tjuaecore 二进制文件和托管资源。
 *
 * 解析顺序：
 *  1. TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR 指定的完整本地资源包
 *  2. TJUAEUI_BACKEND_RUN_ID 指定的 GitHub Actions 产物
 *  3. 固定版本的 GitHub Release 资产
 *  4. TJUAEUI_BACKEND_LOCAL_BINARY 指定的本地二进制文件
 *
 * 输出：{projectRoot}/resources/bundled-tjuaecore/{platform}-{arch}/
 *   - tjuaecore[.exe]
 *   - manifest.json
 *   - managed-resources/...
 *
 * @module prepare-tjuaecore
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyBundledTjuaeCoreResources } = require('./verify-bundled-tjuaecore-resources');

const GITHUB_OWNER = 'liangboqiang';
const GITHUB_REPO = 'TjuaeCore';
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const MANAGED_RESOURCES_PREPARE_MAX_ATTEMPTS = 4;
const PRODUCTION_SOURCE_TYPES = new Set(['download', 'actions-artifact']);

const ACTIONS_ARTIFACT_TARGETS = {
  'darwin-arm64': {
    artifactName: 'tjuaecore-manual-macos-arm64',
    manualPlatform: 'macos-arm64',
  },
  'darwin-x64': {
    artifactName: 'tjuaecore-manual-macos-x64',
    manualPlatform: 'macos-x64',
  },
  'linux-arm64': {
    artifactName: 'tjuaecore-manual-linux-arm64',
    manualPlatform: 'linux-arm64',
  },
  'linux-x64': {
    artifactName: 'tjuaecore-manual-linux-x64',
    manualPlatform: 'linux-x64',
  },
  'win32-arm64': {
    artifactName: 'tjuaecore-manual-windows-arm64',
    manualPlatform: 'windows-arm64',
  },
  'win32-x64': {
    artifactName: 'tjuaecore-manual-windows-x64',
    manualPlatform: 'windows-x64',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function removeDirectorySafe(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyFileSafe(sourcePath, targetPath) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectorySafe(sourcePath, targetPath) {
  ensureDirectory(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
}

function ensureExecutableMode(filePath) {
  if (process.platform === 'win32') return;
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {}
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
}

function getBinaryName(platform) {
  return platform === 'win32' ? 'tjuaecore.exe' : 'tjuaecore';
}

function getActionsTarget(platform, arch) {
  return ACTIONS_ARTIFACT_TARGETS[`${platform}-${arch}`] || null;
}

function getActionsArtifactName(platform, arch) {
  return getActionsTarget(platform, arch)?.artifactName || null;
}

function getActionsManualPlatform(platform, arch) {
  return getActionsTarget(platform, arch)?.manualPlatform || `${platform}-${arch}`;
}

function resolveTjuaeCorePreparationPolicy(env = process.env) {
  const inferredMode = env.CI === 'true' || env.NODE_ENV === 'production' ? 'production' : 'development';
  const mode = String(env.TJUAEUI_BACKEND_BUILD_MODE || inferredMode).trim();
  if (mode !== 'development' && mode !== 'production') {
    throw new Error('TJUAEUI_BACKEND_BUILD_MODE 只能是 development 或 production');
  }

  const localBundleDir = String(env.TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR || '').trim();
  const localBinary = String(env.TJUAEUI_BACKEND_LOCAL_BINARY || '').trim();
  if (mode === 'production' && (localBundleDir || localBinary)) {
    throw new Error('正式构建禁止使用本地 TjuaeCore；请固定 Release 标签或 GitHub Actions 运行产物');
  }

  return { mode, localBundleDir, localBinary };
}

function canReuseTjuaeCoreCache(manifest, policy) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (policy.mode === 'production') return PRODUCTION_SOURCE_TYPES.has(manifest.sourceType);
  return typeof manifest.sourceType === 'string' && manifest.sourceType.length > 0;
}

function getActionsArtifactMissingMessage({ runId, platform, arch, expectedArtifactName, availableArtifactNames }) {
  const available =
    Array.isArray(availableArtifactNames) && availableArtifactNames.length > 0
      ? availableArtifactNames.join(', ')
      : '(none)';
  return [
    `TjuaeCore 运行 ${runId} 不包含 ${platform}-${arch} 所需的产物 [ ${expectedArtifactName} ]。`,
    `可用产物：${available}。`,
    `请重新运行 TjuaeCore 手动构建，平台选择 [ ${getActionsManualPlatform(platform, arch)} ] 或 all。`,
  ].join(' ');
}

function prepareManagedResources(binaryPath, targetDir) {
  const bundleOut = path.join(targetDir, 'managed-resources');
  const dataDir = path.join(targetDir, '.prepare-data');

  removeDirectorySafe(bundleOut);
  removeDirectorySafe(dataDir);
  ensureDirectory(dataDir);

  console.log(`  正在准备托管资源：${path.relative(process.cwd(), bundleOut)}`);
  let lastError;
  for (let attempt = 1; attempt <= MANAGED_RESOURCES_PREPARE_MAX_ATTEMPTS; attempt += 1) {
    removeDirectorySafe(bundleOut);
    ensureDirectory(bundleOut);
    try {
      execFileSync(binaryPath, ['--data-dir', dataDir, 'prepare-managed-resources', '--bundle-out', bundleOut], {
        stdio: 'inherit',
        env: {
          ...process.env,
          TJUAE_BUNDLED_MANAGED_RESOURCES: '',
        },
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt === MANAGED_RESOURCES_PREPARE_MAX_ATTEMPTS) break;
      console.warn(`  托管资源准备失败，正在重试 ${attempt + 1}/${MANAGED_RESOURCES_PREPARE_MAX_ATTEMPTS}……`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 2000);
    }
  }

  if (lastError) {
    removeDirectorySafe(bundleOut);
    removeDirectorySafe(dataDir);
    throw lastError;
  }

  removeDirectorySafe(dataDir);
  return bundleOut;
}

function verifyPreparedTjuaeCoreBundle(projectRoot, platform, arch) {
  const result = verifyBundledTjuaeCoreResources({
    resourcesDir: path.join(projectRoot, 'resources'),
    electronPlatformName: platform,
    targetArch: arch,
  });
  if (result.missing.length > 0 || result.failures.length > 0) {
    const summary = result.missing.length > 0 ? result.missing.join(', ') : JSON.stringify(result.failures);
    throw new Error(`准备后的 tjuaecore 资源包缺少必要资源：${summary}`);
  }
  return result;
}

/**
 * 为指定平台、架构与标签生成发行资产文件名。
 *
 * Expected asset naming convention:
 *   tjuaecore-v0.1.0-aarch64-apple-darwin.tar.gz
 */
function getAssetName(platform, arch, tag) {
  const archMap = { x64: 'x86_64', arm64: 'aarch64' };
  const platformMap = {
    darwin: 'apple-darwin',
    linux: 'unknown-linux-gnu',
    win32: 'pc-windows-msvc',
  };
  const normalizedArch = archMap[arch];
  const normalizedPlatform = platformMap[platform];
  if (!normalizedArch || !normalizedPlatform) return null;
  const ext = platform === 'win32' ? '.zip' : '.tar.gz';
  return `tjuaecore-${tag}-${normalizedArch}-${normalizedPlatform}${ext}`;
}

function getDownloadUrl(assetName, tag) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tag}/${assetName}`;
}

function getDownloadTimeoutMs() {
  const configured = Number.parseInt(process.env.TJUAEUI_BACKEND_DOWNLOAD_TIMEOUT_MS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DOWNLOAD_TIMEOUT_MS;
}

function verifyDownloadedReleaseAsset(outputPath, asset) {
  const actualSize = fs.statSync(outputPath).size;
  if (Number.isFinite(asset.size) && actualSize !== asset.size) {
    throw new Error(`下载资产大小不符：预期 ${asset.size} 字节，实际 ${actualSize} 字节`);
  }

  const expectedDigest = typeof asset.digest === 'string' ? asset.digest.match(/^sha256:([0-9a-f]{64})$/i)?.[1] : null;
  if (expectedDigest) {
    const actualDigest = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex');
    if (actualDigest.toLowerCase() !== expectedDigest.toLowerCase()) {
      throw new Error(`下载资产 SHA-256 校验失败：预期 ${expectedDigest}，实际 ${actualDigest}`);
    }
  }
}

function downloadReleaseAssetViaApi(releaseUrl, outputPath) {
  const match = releaseUrl.match(/\/releases\/download\/([^/]+)\/([^/?#]+)$/);
  if (!match) throw new Error(`无法从发行地址解析标签与资产名：${releaseUrl}`);

  const [, tag, encodedAssetName] = match;
  const assetName = decodeURIComponent(encodedAssetName);
  const release = githubApiGetJson(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`);
  const asset = Array.isArray(release.assets) ? release.assets.find((candidate) => candidate.name === assetName) : null;
  if (!asset?.url) throw new Error(`TjuaeCore ${tag} 发行中未找到资产：${assetName}`);

  console.log(`  直接下载不可用，正在通过 GitHub API 下载并校验资产：${assetName}`);
  downloadFileWithAuth(asset.url, outputPath, 'application/octet-stream');
  verifyDownloadedReleaseAsset(outputPath, asset);
}

function downloadFile(url, outputPath) {
  console.log(`  正在下载 tjuaecore：${url}`);
  const timeout = getDownloadTimeoutMs();
  try {
    execFileSync(
      'curl',
      [
        '-L',
        '--fail',
        '--silent',
        '--show-error',
        '--retry',
        '4',
        '--retry-delay',
        '2',
        '--connect-timeout',
        '30',
        '-o',
        outputPath,
        url,
      ],
      { timeout }
    );
    return;
  } catch (curlError) {
    try {
      downloadReleaseAssetViaApi(url, outputPath);
      return;
    } catch (apiError) {
      if (process.platform !== 'win32') {
        try {
          execFileSync('wget', ['-q', '-O', outputPath, url], { timeout });
          return;
        } catch {
          throw new Error(`下载 tjuaecore 失败：${curlError.message}；GitHub API 后备失败：${apiError.message}`);
        }
      }
      console.warn(`  GitHub API 下载后备失败：${apiError.message}`);
    }
  }

  try {
    const ps = `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${url}' -OutFile '${outputPath.replace(/'/g, "''")}'`;
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout,
    });
  } catch (powershellError) {
    throw new Error(`下载 tjuaecore 失败：${powershellError.message}`);
  }
}

function extractArchive(archivePath, outputDir, platform) {
  ensureDirectory(outputDir);
  if (platform === 'win32' || archivePath.endsWith('.zip')) {
    if (platform === 'win32') {
      const ps = `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${outputDir.replace(/'/g, "''")}' -Force`;
      execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
    } else {
      execFileSync('unzip', ['-o', archivePath, '-d', outputDir]);
    }
  } else {
    execFileSync('tar', ['-xzf', archivePath, '-C', outputDir]);
  }
}

function findBinaryInDir(dir, binaryName) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === binaryName) return fullPath;
    if (entry.isDirectory()) {
      const found = findBinaryInDir(fullPath, binaryName);
      if (found) return found;
    }
  }
  return null;
}

function findTjuaeCoreArchiveInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isFile() &&
      entry.name.startsWith('tjuaecore-') &&
      (entry.name.endsWith('.zip') || entry.name.endsWith('.tar.gz'))
    ) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findTjuaeCoreArchiveInDir(fullPath);
      if (found) return found;
    }
  }
  return null;
}

function getGitHubToken() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
}

function githubApiGetJson(apiPath) {
  const token = getGitHubToken();

  try {
    return JSON.parse(
      execFileSync('gh', ['api', apiPath], {
        encoding: 'utf-8',
        timeout: 15000,
        env: {
          ...process.env,
          GH_TOKEN: token || process.env.GH_TOKEN,
        },
      })
    );
  } catch {
    // gh CLI not available or failed — fall back to curl.
  }

  const headers = ['-H', 'Accept: application/vnd.github+json'];
  if (token) {
    headers.push('-H', `Authorization: Bearer ${token}`);
  }

  const url = `https://api.github.com/${apiPath}`;
  const out = execFileSync('curl', ['-fsSL', ...headers, url], {
    encoding: 'utf-8',
    timeout: 15000,
  });
  return JSON.parse(out);
}

function downloadFileWithAuth(url, outputPath, accept = 'application/vnd.github+json') {
  const token = getGitHubToken();
  const timeout = getDownloadTimeoutMs();
  const headers = ['-H', `Accept: ${accept}`];
  if (token) {
    headers.push('-H', `Authorization: Bearer ${token}`);
  }

  try {
    execFileSync(
      'curl',
      [
        '-L',
        '--fail',
        '--silent',
        '--show-error',
        '--retry',
        '4',
        '--retry-delay',
        '2',
        '--connect-timeout',
        '30',
        ...headers,
        '-o',
        outputPath,
        url,
      ],
      { timeout }
    );
    return;
  } catch {
    // 某些本地环境没有 curl；最终失败前再尝试 gh。
  }

  execFileSync('gh', ['api', url, '--output', outputPath], {
    timeout,
    env: {
      ...process.env,
      GH_TOKEN: token || process.env.GH_TOKEN,
    },
  });
}

function listActionsArtifacts(runId) {
  const response = githubApiGetJson(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/artifacts?per_page=100`
  );
  return Array.isArray(response?.artifacts) ? response.artifacts : [];
}

function downloadAndExtractActionsArtifact(platform, arch, runId) {
  const expectedArtifactName = getActionsArtifactName(platform, arch);
  if (!expectedArtifactName) {
    throw new Error(`不支持的 TjuaeCore Actions 产物目标：${platform}-${arch}`);
  }

  const artifacts = listActionsArtifacts(runId);
  const availableArtifactNames = artifacts
    .map((artifact) => artifact.name)
    .filter(Boolean)
    .toSorted();
  const artifact = artifacts.find((candidate) => candidate.name === expectedArtifactName);
  if (!artifact) {
    throw new Error(
      getActionsArtifactMissingMessage({
        runId,
        platform,
        arch,
        expectedArtifactName,
        availableArtifactNames,
      })
    );
  }

  const tempDir = path.join(os.tmpdir(), 'tjuaecore-prepare-actions', runId, `${platform}-${arch}`);
  const artifactZipPath = path.join(tempDir, `${expectedArtifactName}.zip`);
  const artifactExtractDir = path.join(tempDir, 'artifact');
  const binaryExtractDir = path.join(tempDir, 'binary');

  removeDirectorySafe(tempDir);
  ensureDirectory(tempDir);

  const downloadUrl =
    artifact.archive_download_url ||
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/artifacts/${artifact.id}/zip`;
  console.log(`  正在从 TjuaeCore 运行 ${runId} 下载产物 ${expectedArtifactName}`);
  downloadFileWithAuth(downloadUrl, artifactZipPath);
  extractArchive(artifactZipPath, artifactExtractDir, platform);

  const archivePath = findTjuaeCoreArchiveInDir(artifactExtractDir);
  if (!archivePath) {
    throw new Error(`TjuaeCore 运行 ${runId} 的产物 ${expectedArtifactName} 不包含 tjuaecore 压缩包`);
  }

  extractArchive(archivePath, binaryExtractDir, platform);

  const binaryName = getBinaryName(platform);
  const binaryPath = findBinaryInDir(binaryExtractDir, binaryName);
  if (!binaryPath) {
    throw new Error(`TjuaeCore 运行 ${runId} 的产物 ${expectedArtifactName} 中未找到二进制文件 ${binaryName}`);
  }

  return {
    binaryPath,
    tempDir,
    artifactName: expectedArtifactName,
    archivePath,
    url: downloadUrl,
  };
}

function downloadAndExtract(platform, arch, tag) {
  const assetName = getAssetName(platform, arch, tag);
  if (!assetName) {
    throw new Error(`不支持的 tjuaecore 目标：${platform}-${arch}`);
  }

  const url = getDownloadUrl(assetName, tag);
  const tempDir = path.join(os.tmpdir(), 'tjuaecore-prepare', tag, `${platform}-${arch}`);
  const archivePath = path.join(tempDir, assetName);
  const extractDir = path.join(tempDir, 'extracted');

  removeDirectorySafe(tempDir);
  ensureDirectory(tempDir);

  downloadFile(url, archivePath);
  extractArchive(archivePath, extractDir, platform);

  const binaryName = getBinaryName(platform);
  const binaryPath = findBinaryInDir(extractDir, binaryName);
  if (!binaryPath) {
    throw new Error(`下载的压缩包中未找到二进制文件 ${binaryName}`);
  }

  return { binaryPath, tempDir, url };
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 为打包准备 tjuaecore 二进制文件。
 *
 * @param {object} options - 配置项
 * @param {string} options.projectRoot - 项目根目录
 * @param {string} options.platform - 目标平台（process.platform）
 * @param {string} options.arch - 目标架构（process.arch）
 * @param {string} options.version - 固定的后端版本标签
 * @returns {{ prepared: true; dir: string; sourceType: string }}
 */
function prepareTjuaeCore(options) {
  const { projectRoot, platform, arch, version } = options;
  const runtimeKey = `${platform}-${arch}`;
  const actionsRunId = (process.env.TJUAEUI_BACKEND_RUN_ID || '').trim();
  const policy = resolveTjuaeCorePreparationPolicy(process.env);

  let tag = null;
  if (!actionsRunId) {
    if (typeof version !== 'string' || !version.trim() || version.trim() === 'latest') {
      throw new Error('必须显式提供固定的 tjuaecore 版本标签，不能使用 latest');
    }
    const normalizedVersion = version.trim();
    tag = normalizedVersion.startsWith('v') ? normalizedVersion : `v${normalizedVersion}`;
  }

  const targetDir = path.join(projectRoot, 'resources', 'bundled-tjuaecore', runtimeKey);
  const binaryName = getBinaryName(platform);
  const targetBinaryPath = path.join(targetDir, binaryName);
  const { localBundleDir } = policy;

  console.log(
    `正在为 ${runtimeKey} 准备 tjuaecore（${actionsRunId ? `Actions 运行：${actionsRunId}` : `版本：${tag}`}）`
  );

  if (!actionsRunId && !localBundleDir) {
    const existingManifestPath = path.join(targetDir, 'manifest.json');
    try {
      const existingManifest = JSON.parse(fs.readFileSync(existingManifestPath, 'utf8'));
      if (
        existingManifest.platform === platform &&
        existingManifest.arch === arch &&
        existingManifest.version === tag &&
        canReuseTjuaeCoreCache(existingManifest, policy) &&
        fs.existsSync(targetBinaryPath)
      ) {
        verifyPreparedTjuaeCoreBundle(projectRoot, platform, arch);
        console.log(`  已复用通过契约校验的 tjuaecore 固定版本资源包：${tag}`);
        return { prepared: true, dir: targetDir, sourceType: existingManifest.sourceType, cacheHit: true };
      }
    } catch (error) {
      if (fs.existsSync(targetDir)) {
        console.warn(`  现有 tjuaecore 资源包不可复用，将重新准备：${error.message}`);
      }
    }
  }

  removeDirectorySafe(targetDir);
  ensureDirectory(targetDir);

  if (localBundleDir) {
    const resolvedLocalBundleDir = path.resolve(localBundleDir);
    const localBinaryPath = path.join(resolvedLocalBundleDir, binaryName);
    const localManagedResourcesDir = path.join(resolvedLocalBundleDir, 'managed-resources');
    if (
      fs.existsSync(resolvedLocalBundleDir) &&
      fs.statSync(resolvedLocalBundleDir).isDirectory() &&
      fs.existsSync(localBinaryPath) &&
      fs.existsSync(localManagedResourcesDir)
    ) {
      copyDirectorySafe(resolvedLocalBundleDir, targetDir);
      ensureExecutableMode(targetBinaryPath);
      const manifest = {
        platform,
        arch,
        version: tag || `actions-run-${actionsRunId}` || 'local-bundle',
        generatedAt: new Date().toISOString(),
        sourceType: 'local-bundle',
        source: { path: resolvedLocalBundleDir },
        files: [binaryName, 'managed-resources/'],
      };
      writeJson(path.join(targetDir, 'manifest.json'), manifest);
      verifyPreparedTjuaeCoreBundle(projectRoot, platform, arch);
      console.log(`  正在使用本地 tjuaecore 资源包：${resolvedLocalBundleDir}`);
      return { prepared: true, dir: targetDir, sourceType: 'local-bundle' };
    }
    console.warn(`  本地 tjuaecore 资源包缺失或不完整：${resolvedLocalBundleDir}`);
  }

  let sourcePath = null;
  let sourceType = 'none';
  let sourceDetail = {};
  let tempDir = null;

  // 1. 提供手动构建运行 ID 时，从 GitHub Actions 产物下载。
  if (actionsRunId) {
    const result = downloadAndExtractActionsArtifact(platform, arch, actionsRunId);
    sourcePath = result.binaryPath;
    tempDir = result.tempDir;
    sourceType = 'actions-artifact';
    sourceDetail = {
      runId: actionsRunId,
      artifactName: result.artifactName,
      url: result.url,
    };
    console.log('  已从 GitHub Actions 产物下载');
  }

  // 2. 从固定版本的 GitHub Release 下载。
  if (!sourcePath && tag) {
    try {
      const result = downloadAndExtract(platform, arch, tag);
      sourcePath = result.binaryPath;
      tempDir = result.tempDir;
      sourceType = 'download';
      sourceDetail = { url: result.url };
      console.log('  已从 GitHub Release 下载');
    } catch (error) {
      console.warn(`  下载失败：${error.message}`);
    }
  }

  // 3. 网络下载不可用时，使用显式指定的本地二进制文件。
  if (!sourcePath) {
    const { localBinary } = policy;
    if (localBinary) {
      const resolvedLocalBinary = path.resolve(localBinary);
      if (fs.existsSync(resolvedLocalBinary) && fs.statSync(resolvedLocalBinary).isFile()) {
        sourcePath = resolvedLocalBinary;
        sourceType = 'local-binary';
        sourceDetail = { path: resolvedLocalBinary };
        console.log(`  正在使用本地 tjuaecore 二进制文件：${resolvedLocalBinary}`);
      } else {
        console.warn(`  未找到本地 tjuaecore 二进制文件：${resolvedLocalBinary}`);
      }
    }
  }

  // 写入最终资源包。
  if (sourcePath) {
    copyFileSafe(sourcePath, targetBinaryPath);
    ensureExecutableMode(targetBinaryPath);
    const bundledManagedResourcesDir = prepareManagedResources(targetBinaryPath, targetDir);

    // 发布标签是资源来源的权威版本；清单同时记录来源类型以便安装诊断。
    const manifest = {
      platform,
      arch,
      version: tag || `actions-run-${actionsRunId}`,
      generatedAt: new Date().toISOString(),
      sourceType,
      source: sourceDetail,
      files: [binaryName, 'managed-resources/'],
    };

    writeJson(path.join(targetDir, 'manifest.json'), manifest);
    verifyPreparedTjuaeCoreBundle(projectRoot, platform, arch);
    console.log(`  已准备内置 tjuaecore：resources/bundled-tjuaecore/${runtimeKey}/${binaryName} [来源=${sourceType}]`);
    console.log(`  已准备内置托管资源：${bundledManagedResourcesDir}`);

    if (tempDir) removeDirectorySafe(tempDir);
    return { prepared: true, dir: targetDir, sourceType };
  }

  throw new Error(`未找到 ${runtimeKey} 的 tjuaecore 二进制文件（标签：${tag}）`);
}

module.exports = {
  canReuseTjuaeCoreCache,
  getActionsArtifactMissingMessage,
  getActionsArtifactName,
  prepareTjuaeCore,
  resolveTjuaeCorePreparationPolicy,
  verifyPreparedTjuaeCoreBundle,
};
