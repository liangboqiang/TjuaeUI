/**
 * prepareHubResources.js
 *
 * 下载 TjuaeHub 的 index.json 与全部扩展压缩包，放入 resources/hub/，
 * 随应用打包作为本地后备。
 *
 * 由构建流水线在 electron-builder 运行前调用。
 *
 * 环境变量：
 *   TJUAEUI_HUB_REF    - 临时覆盖 package.json 中固定的 tjuaeHubRef
 *   TJUAEUI_HUB_SKIP   - 设为 1 时跳过 Hub 资源准备
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HUB_DIR = path.join(PROJECT_ROOT, 'resources', 'hub');

const DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 从固定的 TjuaeHub 分发提交下载文件，并返回来源地址。
 */
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

function resolveHubRef() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const ref = String(process.env.TJUAEUI_HUB_REF || packageJson.tjuaeHubRef || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(ref)) {
    throw new Error('必须在 package.json 的 tjuaeHubRef 中固定 40 位 TjuaeHub 提交哈希');
  }
  return ref;
}

function verifyIntegrity(filePath, integrity) {
  const expected = typeof integrity === 'string' ? integrity.match(/^sha256-([0-9a-f]{64})$/i)?.[1] : null;
  if (!expected) throw new Error(`${path.basename(filePath)} 缺少有效的 sha256 完整性声明`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${path.basename(filePath)} 完整性校验失败：预期 ${expected}，实际 ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function prepareHubResources() {
  if (process.env.TJUAEUI_HUB_SKIP === '1') {
    console.log('[hub] TJUAEUI_HUB_SKIP=1，已跳过 Hub 资源准备');
    return { skipped: true };
  }

  const ref = resolveHubRef();
  console.log(`[hub] 正在从固定提交 ${ref} 准备 Hub 资源`);

  // 清理并创建目标目录。
  if (fs.existsSync(HUB_DIR)) {
    fs.rmSync(HUB_DIR, { recursive: true, force: true });
  }
  ensureDir(HUB_DIR);

  // 第 1 步：下载 index.json。
  const indexPath = path.join(HUB_DIR, 'index.json');
  console.log('[hub] 正在下载 index.json……');
  const indexUrl = downloadFile(ref, 'index.json', indexPath);
  console.log(`[hub] 已从 ${indexUrl} 下载 index.json`);

  // 第 2 步：解析索引并下载全部扩展压缩包。
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const extensions = index.extensions || {};
  const names = Object.keys(extensions);

  console.log(`[hub] 找到 ${names.length} 个待打包扩展`);

  const results = [];
  for (const name of names) {
    const ext = extensions[name];
    const tarball = ext.dist?.tarball;
    if (!tarball) {
      throw new Error(`${name} 缺少 dist.tarball，无法生成完整的离线资源包`);
    }

    const zipPath = path.join(HUB_DIR, path.basename(tarball));
    const url = downloadFile(ref, tarball, zipPath);
    verifyIntegrity(zipPath, ext.dist?.archiveIntegrity);
    const size = fs.statSync(zipPath).size;
    console.log(`[hub] ${name} -> ${path.basename(tarball)}（${(size / 1024).toFixed(1)} KB，校验通过）`);
    results.push({
      name,
      file: path.basename(tarball),
      size,
      integrity: ext.dist.integrity,
      archiveIntegrity: ext.dist.archiveIntegrity,
      url,
    });
  }

  if (results.length !== names.length) {
    throw new Error(`Hub 离线资源不完整：预期 ${names.length} 个扩展，实际 ${results.length} 个`);
  }

  // 第 3 步：写入可追踪、可验证的清单。
  const manifest = {
    ref,
    generatedAt: new Date().toISOString(),
    indexUrl,
    extensions: results,
  };
  fs.writeFileSync(path.join(HUB_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`[hub] 完成：已将 ${results.length}/${names.length} 个扩展打包到 resources/hub/`);
  return { skipped: false, count: results.length, total: names.length };
}

// 同时支持直接执行和被 build-with-builder.js 引用。
if (require.main === module) {
  try {
    prepareHubResources();
  } catch (err) {
    console.error('[hub] 严重错误：', err);
    process.exit(1);
  }
}

module.exports = { prepareHubResources, resolveHubRef, verifyIntegrity };
