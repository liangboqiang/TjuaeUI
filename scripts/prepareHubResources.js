/**
 * prepareHubResources.js
 *
 * 准备 TjuaeHub 的技能与助手目录索引，放入 resources/hub/，随应用打包
 * 作为只读后备。资产内容始终按索引中的 Git revision 从远程仓库读取，
 * 不在安装包内分发 ZIP 或安装器。
 *
 * 由构建流水线在 electron-builder 运行前调用。
 *
 * 环境变量：
 *   TJUAEUI_HUB_REF    - 临时覆盖 package.json 中固定的 tjuaeHubRef
 *   TJUAEUI_HUB_WORKTREE - 从指定的本地 TjuaeHub 工作树准备（开发/验收用）
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

function resolveHubWorktree() {
  const configured = String(process.env.TJUAEUI_HUB_WORKTREE || '').trim();
  if (!configured) return null;
  const worktree = path.resolve(configured);
  if (!fs.existsSync(path.join(worktree, 'dist', 'skills.json'))) {
    throw new Error(`TJUAEUI_HUB_WORKTREE 缺少 dist/skills.json：${worktree}`);
  }
  if (!fs.existsSync(path.join(worktree, 'dist', 'assistants.json'))) {
    throw new Error(`TJUAEUI_HUB_WORKTREE 缺少 dist/assistants.json：${worktree}`);
  }
  return worktree;
}

function prepareIndex({ ref, worktree, relativePath, fileName, assetKey }) {
  const destination = path.join(HUB_DIR, fileName);
  let source;
  if (worktree) {
    fs.copyFileSync(path.join(worktree, relativePath), destination);
    source = 'local-worktree';
  } else {
    source = downloadFile(ref, relativePath, destination);
  }

  const index = JSON.parse(fs.readFileSync(destination, 'utf-8'));
  if (index.schemaVersion !== 1 || !index.market || !Array.isArray(index[assetKey])) {
    throw new Error(`${relativePath} 不符合 Tjuae ${assetKey === 'skills' ? '技能' : '助手'}目录索引协议`);
  }
  return {
    file: fileName,
    source,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex'),
    count: index[assetKey].length,
  };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function prepareHubResources() {
  if (process.env.TJUAEUI_HUB_SKIP === '1') {
    console.log('[hub] TJUAEUI_HUB_SKIP=1，已跳过 Hub 资源准备');
    return { skipped: true };
  }

  const worktree = resolveHubWorktree();
  const ref = worktree ? null : resolveHubRef();
  console.log(worktree ? '[hub] 正在从本地 TjuaeHub 工作树准备 Hub 资源' : `[hub] 正在从固定提交 ${ref} 准备 Hub 资源`);

  // 清理并创建目标目录。
  if (fs.existsSync(HUB_DIR)) {
    fs.rmSync(HUB_DIR, { recursive: true, force: true });
  }
  ensureDir(HUB_DIR);

  const skills = prepareIndex({
    ref,
    worktree,
    relativePath: 'dist/skills.json',
    fileName: 'skills.json',
    assetKey: 'skills',
  });
  const assistants = prepareIndex({
    ref,
    worktree,
    relativePath: 'dist/assistants.json',
    fileName: 'assistants.json',
    assetKey: 'assistants',
  });
  const manifest = {
    ref,
    generatedAt: new Date().toISOString(),
    source: worktree ? 'local-worktree' : 'pinned-git-revision',
    indexes: { skills, assistants },
  };
  fs.writeFileSync(path.join(HUB_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`[hub] 完成：已写入 ${skills.count} 个技能和 ${assistants.count} 个助手的目录索引`);
  return { skipped: false, skillCount: skills.count, assistantCount: assistants.count };
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

module.exports = { prepareHubResources, resolveHubRef, resolveHubWorktree };
