/**
 * 准备 TjuaeHub v2 官方资产离线种子。
 *
 * 正式构建从 package.json.tjuaeHubRef（或 TJUAEUI_HUB_REF）固定的 dist
 * 提交下载 seed-manifest.json 与内容寻址种子 ZIP。开发时可显式设置
 * TJUAEUI_HUB_SOURCE_DIR 指向本地 TjuaeHub 仓库（或其 dist 目录）。
 *
 * 环境变量：
 *   TJUAEUI_HUB_REF            - 临时覆盖 package.json 中固定的 dist 提交
 *   TJUAEUI_HUB_SOURCE_DIR     - 仅开发使用的本地 TjuaeHub 仓库或 dist 目录
 *   TJUAEUI_HUB_SKIP           - 仅开发模式可设为 1 跳过资源准备
 *   TJUAEUI_HUB_BUILD_MODE     - development 或 production；正式打包强制 production
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const yauzl = require('yauzl');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HUB_DIR = path.join(PROJECT_ROOT, 'resources', 'hub');
const HUB_REPOSITORY = 'https://github.com/liangboqiang/TjuaeHub';
const OFFLINE_SEED_SCHEMA_URL =
  'https://raw.githubusercontent.com/liangboqiang/TjuaeHub/main/schemas/offline-seed-manifest.v1.schema.json';
const HUB_INDEX_SCHEMA_URL =
  'https://raw.githubusercontent.com/liangboqiang/TjuaeHub/main/schemas/hub-index.v2.schema.json';
const RESOURCE_MANIFEST_SCHEMA = 'tjuae://schemas/hub-offline-resources.v1';

const DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;
const MANIFEST_MAX_BYTES = 256 * 1024;
const INDEX_MAX_BYTES = 8 * 1024 * 1024;
const PACKAGE_MAX_BYTES = 50 * 1024 * 1024;
const SEED_BUNDLE_MAX_BYTES = 256 * 1024 * 1024;
const SEED_MAX_ENTRIES = 4096;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} 必须是对象`);
}

function assertExactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} 字段不符合固定契约：${actual.join(', ')}`);
  }
}

function assertLowercaseCommit(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value)) {
    throw new Error(`${label} 必须是 40 或 64 位小写提交哈希`);
  }
}

function parseIntegrity(value, label) {
  const match = typeof value === 'string' ? value.match(/^sha256-([0-9a-f]{64})$/) : null;
  if (!match) throw new Error(`${label} 缺少有效的 sha256 完整性声明`);
  return match[1];
}

function digestBytes(bytes) {
  return `sha256-${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function verifyBytesIntegrity(bytes, integrity, label) {
  parseIntegrity(integrity, label);
  const actual = digestBytes(bytes);
  if (actual !== integrity) {
    throw new Error(`${label} 完整性校验失败：预期 ${integrity}，实际 ${actual}`);
  }
}

function verifyIntegrity(filePath, integrity) {
  const bytes = readRegularFileBounded(filePath, SEED_BUNDLE_MAX_BYTES, path.basename(filePath));
  verifyBytesIntegrity(bytes, integrity, path.basename(filePath));
}

function assertIsoDate(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} 必须是 ISO 日期`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} 必须是规范 ISO 日期`);
  }
}

function assertSortedUniqueStrings(values, pattern, label) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} 至少包含一项`);
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`${label} 包含无效值：${String(value)}`);
    if (seen.has(value)) throw new Error(`${label} 包含重复值：${value}`);
    seen.add(value);
  }
  const sorted = [...values].sort();
  if (values.some((value, index) => value !== sorted[index])) {
    throw new Error(`${label} 必须按字典序排列，以保证可复现`);
  }
}

function validateSeedManifest(manifest) {
  assertExactKeys(
    manifest,
    [
      '$schema',
      'schemaVersion',
      'generatedAt',
      'sourceRevision',
      'seedIndexDigest',
      'bundle',
      'assetKinds',
      'packageNames',
      'assetIds',
    ],
    '离线种子清单'
  );
  if (manifest.$schema !== OFFLINE_SEED_SCHEMA_URL || manifest.schemaVersion !== 1) {
    throw new Error('离线种子清单 schema 不受支持');
  }
  assertIsoDate(manifest.generatedAt, 'generatedAt');
  assertLowercaseCommit(manifest.sourceRevision, 'sourceRevision');
  parseIntegrity(manifest.seedIndexDigest, 'seedIndexDigest');
  assertExactKeys(manifest.bundle, ['fileName', 'digest', 'size'], 'bundle');
  const bundleHex = parseIntegrity(manifest.bundle.digest, 'bundle.digest');
  if (manifest.bundle.fileName !== `tjuae-seed-${bundleHex}.zip`) {
    throw new Error('离线种子文件名与内容摘要不一致');
  }
  if (
    !Number.isSafeInteger(manifest.bundle.size) ||
    manifest.bundle.size < 1 ||
    manifest.bundle.size > SEED_BUNDLE_MAX_BYTES
  ) {
    throw new Error('离线种子大小超过安全限制');
  }
  assertSortedUniqueStrings(manifest.assetKinds, /^(?:assistant|engineAdapter|skill|mcp)$/, 'assetKinds');
  if (manifest.assetKinds.join(',') !== 'assistant,engineAdapter,mcp,skill') {
    throw new Error('assetKinds 必须完整且仅包含四类核心资产');
  }
  assertSortedUniqueStrings(manifest.packageNames, /^tjuaeasset-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'packageNames');
  assertSortedUniqueStrings(
    manifest.assetIds,
    /^tjuaeasset-[a-z0-9]+(?:-[a-z0-9]+)*\/(?:assistant|engineAdapter|skill|mcp)\/[a-z0-9]+(?:[._:-][a-z0-9]+)*$/,
    'assetIds'
  );
  return manifest;
}

function readRegularFileBounded(filePath, limit, label) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} 必须是普通文件`);
  if (stat.size > limit) throw new Error(`${label} 超过 ${limit} 字节安全限制`);
  return fs.readFileSync(filePath);
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} 不是有效 JSON：${error.message}`);
  }
}

function safeSeedEntryName(name) {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    name.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return false;
  }
  return true;
}

function readZipEntries(bytes) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      bytes,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
      (openError, zipFile) => {
        if (openError || !zipFile) {
          reject(new Error(`离线种子不是有效 ZIP：${openError?.message || '无法打开'}`));
          return;
        }
        const entries = new Map();
        const namesLowercase = new Set();
        let count = 0;
        let totalSize = 0;
        let settled = false;

        const fail = (error) => {
          if (settled) return;
          settled = true;
          zipFile.close();
          reject(error instanceof Error ? error : new Error(String(error)));
        };

        zipFile.on('error', fail);
        zipFile.on('entry', (entry) => {
          count += 1;
          if (count > SEED_MAX_ENTRIES) {
            fail(new Error('离线种子 ZIP 条目过多'));
            return;
          }
          const name = entry.fileName;
          if (!safeSeedEntryName(name) || /\/$/.test(name)) {
            fail(new Error(`离线种子包含不安全路径：${name}`));
            return;
          }
          const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
          if ((unixMode & 0o170000) === 0o120000) {
            fail(new Error(`离线种子不允许符号链接：${name}`));
            return;
          }
          const lower = name.toLowerCase();
          if (namesLowercase.has(lower)) {
            fail(new Error(`离线种子包含冲突路径：${name}`));
            return;
          }
          namesLowercase.add(lower);
          const limit = name === 'seed-index.json' ? INDEX_MAX_BYTES : PACKAGE_MAX_BYTES;
          if (entry.uncompressedSize > limit) {
            fail(new Error(`离线种子条目超过安全限制：${name}`));
            return;
          }
          totalSize += entry.uncompressedSize;
          if (totalSize > SEED_BUNDLE_MAX_BYTES) {
            fail(new Error('离线种子解压总大小超过安全限制'));
            return;
          }
          zipFile.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail(new Error(`无法读取离线种子条目 ${name}：${streamError?.message || '未知错误'}`));
              return;
            }
            const chunks = [];
            let size = 0;
            stream.on('data', (chunk) => {
              size += chunk.length;
              if (size > limit) {
                stream.destroy(new Error(`离线种子条目超过安全限制：${name}`));
                return;
              }
              chunks.push(chunk);
            });
            stream.on('error', fail);
            stream.on('end', () => {
              if (size !== entry.uncompressedSize) {
                fail(new Error(`离线种子条目大小不一致：${name}`));
                return;
              }
              entries.set(name, Buffer.concat(chunks));
            });
            stream.on('close', () => {
              if (!settled) zipFile.readEntry();
            });
          });
        });
        zipFile.on('end', () => {
          if (settled) return;
          settled = true;
          resolve(entries);
        });
        zipFile.readEntry();
      }
    );
  });
}

function exactSortedKeys(value) {
  assertPlainObject(value, '对象');
  return Object.keys(value).sort();
}

function normalizeRepositoryUrl(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '').replace(/\.git$/, '') : '';
}

function assertSameStringSet(actual, expected, label) {
  const sorted = [...actual].sort();
  if (sorted.length !== expected.length || sorted.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} 与离线种子清单不一致`);
  }
}

function validateAtomicPackageLocation(packageName, packageEntry) {
  assertPlainObject(packageEntry, `包 ${packageName}`);
  if (
    normalizeRepositoryUrl(packageEntry.repository) !== HUB_REPOSITORY ||
    packageEntry.sourcePath !== `assets/${packageName}` ||
    packageEntry.manifestPath !== `assets/${packageName}/asset-package.json`
  ) {
    throw new Error(`包 ${packageName} 必须使用 assets/{packageName}/asset-package.json 纯声明布局`);
  }
}

async function validateSeedBundle(bundleBytes, manifest) {
  if (bundleBytes.length !== manifest.bundle.size) {
    throw new Error(`离线种子大小不一致：预期 ${manifest.bundle.size}，实际 ${bundleBytes.length}`);
  }
  verifyBytesIntegrity(bundleBytes, manifest.bundle.digest, manifest.bundle.fileName);
  const entries = await readZipEntries(bundleBytes);
  const expectedPaths = ['seed-index.json', ...manifest.packageNames.map((name) => `packages/${name}.zip`)].sort();
  assertSameStringSet(entries.keys(), expectedPaths, '离线种子 ZIP 条目');

  const seedIndexBytes = entries.get('seed-index.json');
  verifyBytesIntegrity(seedIndexBytes, manifest.seedIndexDigest, 'seed-index.json');
  const index = parseJsonBytes(seedIndexBytes, 'seed-index.json');
  assertExactKeys(index, ['$schema', 'schemaVersion', 'generatedAt', 'assets', 'packages', 'metadata'], 'seed-index');
  if (
    index.$schema !== HUB_INDEX_SCHEMA_URL ||
    index.schemaVersion !== 2 ||
    index.generatedAt !== manifest.generatedAt
  ) {
    throw new Error('seed-index 的 schema 或生成时间与清单不一致');
  }
  assertSameStringSet(exactSortedKeys(index.assets), manifest.assetIds, 'seed-index 资产');
  assertSameStringSet(exactSortedKeys(index.packages), manifest.packageNames, 'seed-index 包');
  assertPlainObject(index.metadata, 'seed-index.metadata');
  if (
    normalizeRepositoryUrl(index.metadata.repository) !== HUB_REPOSITORY ||
    index.metadata.sourceRevision !== manifest.sourceRevision ||
    index.metadata.totalAssets !== manifest.assetIds.length ||
    index.metadata.totalPackages !== manifest.packageNames.length
  ) {
    throw new Error('seed-index 元数据与离线种子清单不一致');
  }

  for (const assetId of manifest.assetIds) {
    const asset = index.assets[assetId];
    assertPlainObject(asset, `资产 ${assetId}`);
    if (
      asset.id !== assetId ||
      asset.trust !== 'official' ||
      asset.sourceRevision !== manifest.sourceRevision ||
      !manifest.packageNames.includes(asset.packageName)
    ) {
      throw new Error(`官方资产 ${assetId} 的身份、信任或来源无效`);
    }
  }

  for (const packageName of manifest.packageNames) {
    const packageEntry = index.packages[packageName];
    validateAtomicPackageLocation(packageName, packageEntry);
    const nestedBytes = entries.get(`packages/${packageName}.zip`);
    if (
      packageEntry.name !== packageName ||
      packageEntry.tarball !== `${packageName}.zip` ||
      packageEntry.sourceRevision !== manifest.sourceRevision ||
      !Array.isArray(packageEntry.assetIds) ||
      packageEntry.assetIds.length !== 1 ||
      !manifest.assetIds.includes(packageEntry.assetIds[0])
    ) {
      throw new Error(`包 ${packageName} 的原子身份或来源无效`);
    }
    verifyBytesIntegrity(nestedBytes, packageEntry.archiveIntegrity, `packages/${packageName}.zip`);
    if (index.assets[packageEntry.assetIds[0]].packageName !== packageName) {
      throw new Error(`包 ${packageName} 与资产交叉引用不一致`);
    }
  }
  return index;
}

function downloadFile(ref, relativePath, destPath) {
  const rawUrl = `https://raw.githubusercontent.com/liangboqiang/TjuaeHub/${ref}/${relativePath}`;
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  const apiUrl = `https://api.github.com/repos/liangboqiang/TjuaeHub/contents/${encodedPath}?ref=${ref}`;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

  const downloadFromApi = () => {
    const headers = ['-H', 'Accept: application/vnd.github+json', '-H', 'User-Agent: TjuaeUI-build'];
    if (token) headers.push('-H', `Authorization: Bearer ${token}`);
    const response = JSON.parse(
      execFileSync(
        'curl',
        [
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
          apiUrl,
        ],
        { encoding: 'utf8', timeout: DOWNLOAD_TIMEOUT_MS }
      )
    );
    if (response.type !== 'file' || response.encoding !== 'base64' || typeof response.content !== 'string') {
      throw new Error(`GitHub API 未返回文件内容：${relativePath}`);
    }
    fs.writeFileSync(destPath, Buffer.from(response.content.replace(/\s/g, ''), 'base64'));
    return apiUrl;
  };

  if (token) {
    try {
      return downloadFromApi();
    } catch (error) {
      console.warn(`[hub] GitHub API 获取 ${relativePath} 失败，正在尝试原始文件地址：${error.message}`);
    }
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
        '-o',
        destPath,
        rawUrl,
      ],
      { timeout: DOWNLOAD_TIMEOUT_MS }
    );
    return rawUrl;
  } catch {
    const sourceUrl = downloadFromApi();
    console.log(`[hub] 原始文件地址不可用，已通过 GitHub API 获取 ${relativePath}`);
    return sourceUrl;
  }
}

function resolveHubRef(projectRoot = PROJECT_ROOT, env = process.env) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const ref = String(env.TJUAEUI_HUB_REF || packageJson.tjuaeHubRef || '').trim();
  if (!/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error('必须在 package.json 的 tjuaeHubRef 中固定真实的 40 位小写 TjuaeHub dist 提交哈希');
  }
  return ref;
}

function resolveLocalDistDirectory(sourceDirectory) {
  const root = path.resolve(sourceDirectory);
  for (const candidate of [root, path.join(root, 'dist')]) {
    if (fs.existsSync(path.join(candidate, 'seed-manifest.json'))) return candidate;
  }
  throw new Error(`本地 TjuaeHub 源缺少 dist/seed-manifest.json：${root}`);
}

function resolveHubPreparationPolicy(env, localSource) {
  const inferredMode = env.CI === 'true' || env.NODE_ENV === 'production' ? 'production' : 'development';
  const mode = String(env.TJUAEUI_HUB_BUILD_MODE || inferredMode).trim();
  if (mode !== 'development' && mode !== 'production') {
    throw new Error('TJUAEUI_HUB_BUILD_MODE 只能是 development 或 production');
  }

  const skip = env.TJUAEUI_HUB_SKIP === '1';
  if (mode === 'production' && skip) {
    throw new Error('正式构建禁止跳过 TjuaeHub 离线种子准备');
  }
  if (mode === 'production' && localSource) {
    throw new Error('正式构建禁止使用本地 TjuaeHub 源；请固定并使用真实 dist 提交');
  }

  return { mode, skip };
}

function renameWithTransientRetry(source, target) {
  const retryable = new Set(['EPERM', 'EACCES', 'EBUSY']);
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.renameSync(source, target);
      return;
    } catch (error) {
      lastError = error;
      if (!retryable.has(error?.code) || attempt === 7) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
    }
  }
  throw lastError;
}

function replaceGeneratedDirectory(stageDir, targetDir) {
  const resolvedTarget = path.resolve(targetDir);
  if (path.dirname(resolvedTarget) === resolvedTarget) throw new Error('拒绝替换文件系统根目录');
  const backup = `${resolvedTarget}.backup-${process.pid}`;
  if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  let movedExisting = false;
  try {
    if (fs.existsSync(resolvedTarget)) {
      renameWithTransientRetry(resolvedTarget, backup);
      movedExisting = true;
    }
    renameWithTransientRetry(stageDir, resolvedTarget);
    if (movedExisting) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(resolvedTarget) && movedExisting && fs.existsSync(backup)) {
      renameWithTransientRetry(backup, resolvedTarget);
    }
    throw error;
  }
}

async function prepareHubResources(options = {}) {
  const env = options.env || process.env;
  const localSource = String(options.sourceDir || env.TJUAEUI_HUB_SOURCE_DIR || '').trim();
  const policy = resolveHubPreparationPolicy(env, localSource);
  if (policy.skip) {
    console.log('[hub] TJUAEUI_HUB_SKIP=1，已跳过 Hub 离线种子准备');
    return { skipped: true };
  }

  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const hubDir = path.resolve(options.hubDir || HUB_DIR);

  ensureDir(path.dirname(hubDir));
  const stageDir = `${hubDir}.stage-${process.pid}-${Date.now()}`;
  if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
  ensureDir(stageDir);

  try {
    const seedManifestPath = path.join(stageDir, 'seed-manifest.json');
    let source;
    if (localSource) {
      const distDir = resolveLocalDistDirectory(localSource);
      const localManifest = path.join(distDir, 'seed-manifest.json');
      fs.copyFileSync(localManifest, seedManifestPath);
      source = { kind: 'localSibling', repository: HUB_REPOSITORY };
      console.log(`[hub] 正在从本地 TjuaeHub v2 分发目录准备离线种子：${distDir}`);
    } else {
      const ref = resolveHubRef(projectRoot, env);
      const url = downloadFile(ref, 'seed-manifest.json', seedManifestPath);
      source = { kind: 'pinnedDist', repository: HUB_REPOSITORY, distRef: ref };
      console.log(`[hub] 已从固定 dist 提交 ${ref} 下载种子清单：${url}`);
    }

    const seedManifestBytes = readRegularFileBounded(seedManifestPath, MANIFEST_MAX_BYTES, 'seed-manifest.json');
    const seedManifest = validateSeedManifest(parseJsonBytes(seedManifestBytes, 'seed-manifest.json'));
    if (source.kind === 'localSibling') source.sourceRevision = seedManifest.sourceRevision;

    const bundlePath = path.join(stageDir, seedManifest.bundle.fileName);
    if (localSource) {
      const distDir = resolveLocalDistDirectory(localSource);
      fs.copyFileSync(path.join(distDir, seedManifest.bundle.fileName), bundlePath);
    } else {
      downloadFile(source.distRef, seedManifest.bundle.fileName, bundlePath);
    }
    const bundleBytes = readRegularFileBounded(bundlePath, SEED_BUNDLE_MAX_BYTES, seedManifest.bundle.fileName);
    const seedIndex = await validateSeedBundle(bundleBytes, seedManifest);

    const runtimeManifest = {
      $schema: RESOURCE_MANIFEST_SCHEMA,
      schemaVersion: 1,
      source,
      seedManifest: {
        fileName: 'seed-manifest.json',
        digest: digestBytes(seedManifestBytes),
        size: seedManifestBytes.length,
      },
      bundle: seedManifest.bundle,
    };
    fs.writeFileSync(path.join(stageDir, 'manifest.json'), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
    replaceGeneratedDirectory(stageDir, hubDir);

    console.log(
      `[hub] 完成：${seedIndex.metadata.totalAssets} 项官方资产、${seedIndex.metadata.totalPackages} 个原子包，种子 ${seedManifest.bundle.fileName}`
    );
    return {
      skipped: false,
      source: source.kind,
      distRef: source.distRef,
      assetCount: seedIndex.metadata.totalAssets,
      packageCount: seedIndex.metadata.totalPackages,
      bundleFileName: seedManifest.bundle.fileName,
    };
  } finally {
    if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  prepareHubResources().catch((error) => {
    console.error('[hub] 严重错误：', error);
    process.exitCode = 1;
  });
}

module.exports = {
  HUB_INDEX_SCHEMA_URL,
  OFFLINE_SEED_SCHEMA_URL,
  RESOURCE_MANIFEST_SCHEMA,
  prepareHubResources,
  resolveHubRef,
  resolveHubPreparationPolicy,
  validateAtomicPackageLocation,
  validateSeedBundle,
  validateSeedManifest,
  verifyIntegrity,
};
