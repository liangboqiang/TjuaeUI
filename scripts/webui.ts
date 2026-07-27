#!/usr/bin/env bun
/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure Bun CLI — launches the WebUI (backend + static server + auth) without
 * starting Electron. Replaces the former `electron-vite dev -- --webui` flow.
 *
 * Env vars:
 *   TJUAEUI_PORT           : static server port (default 33000)
 *   TJUAEUI_HOST           : listen host; set to 0.0.0.0 to imply --remote
 *   TJUAEUI_ALLOW_REMOTE   : "1"/"true" to expose to LAN
 *   TJUAEUI_DATA_DIR       : override userData path (default Electron-compatible)
 *   TJUAEUI_LOG_DIR        : override log dir (default <dataDir>/logs)
 *   TJUAEUI_STATIC_DIR     : override static dir (default out/renderer)
 *   TJUAEUI_BACKEND_BIN    : absolute path to tjuaecore binary (else PATH lookup)
 *   TJUAEUI_BACKEND_BUNDLED_DIR : dir containing bundled-tjuaecore/<plat-arch>/binary
 *   TJUAEUI_OPEN_BROWSER   : "1"/"true" to force open, "0"/"false" to disable
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { startWebHost } from '@tjuae/web-host';
import { openBrowserUrl, shouldAutoOpenBrowser } from '../packages/web-cli/src/browser.js';

// Aligned with packages/desktop/src/common/config/constants.ts WEBUI_DEFAULT_PORT.
const DEFAULT_PORT = (() => {
  if (process.env.NODE_ENV === 'production') return 25808;
  if (process.env.TJUAEUI_MULTI_INSTANCE === '1') return 25810;
  return 25809;
})();
const BACKEND_BINARY = process.platform === 'win32' ? 'tjuaecore.exe' : 'tjuaecore';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

const args = process.argv.slice(2);
const has = (name: string): boolean => args.includes(name);
const getFlag = (name: string): string | undefined => {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  return next && !next.startsWith('--') ? next : undefined;
};

/**
 * Resolve the directory where tjuaecore persists its SQLite DB.
 *
 * `bun run webui` runs **independently of the Electron desktop app** — it must
 * work on hosts that never installed TjuaeUI.app, and its default work dir must
 * NOT collide with Electron's.
 *
 *   --data-dir <path>       CLI override (highest priority)
 *   $TJUAEUI_DATA_DIR        env override (same effect)
 *   otherwise               ~/.tjuaeui-web         (production)
 *                           ~/.tjuaeui-web-dev     (dev, default)
 *                           ~/.tjuaeui-web-dev-2   (dev + TJUAEUI_MULTI_INSTANCE=1)
 *
 * Why a dedicated `-web` name, not the same `~/.tjuaeui[-dev]` that Electron
 * uses: on macOS, Electron's getDataPath() (packages/desktop/src/process/utils/
 * utils.ts) creates `~/.tjuaeui-dev` as a **symlink** to
 * `~/Library/Application Support/TjuaeUI-Dev/tjuaeui` so CLI tools (claude,
 * gemini, qwen…) don't choke on the literal space in "Application Support".
 * If standalone webui runs first on a clean machine, it would create the
 * symlink location as a **real directory** instead. When Electron is later
 * installed, its `ensureCliSafeSymlink` refuses to overwrite a real dir and
 * falls back to returning the space-containing path — and then every ACP
 * agent inside the desktop app starts failing on CLI commands. Using
 * `.tjuaeui-web` keeps standalone webui's data dir off of the path Electron's
 * symlink needs.
 *
 * If the user wants the two to share data they opt-in explicitly via
 *   --data-dir ~/.tjuaeui-dev                     (or equivalent on other OSes)
 * which is safe because by that point Electron has created the symlink and
 * `bun run webui` just follows it.
 */
function resolveBackendDataDir(): string {
  const override = getFlag('--data-dir') ?? process.env.TJUAEUI_DATA_DIR;
  if (override && override.trim().length > 0) {
    const resolved = path.resolve(override);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }
  const suffix =
    process.env.NODE_ENV === 'production' ? '' : process.env.TJUAEUI_MULTI_INSTANCE === '1' ? '-dev-2' : '-dev';
  const dir = path.join(os.homedir(), `.tjuaeui-web${suffix}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseBoolean(v: string | undefined): boolean {
  if (!v) return false;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

function resolvePort(): number {
  const cli = getFlag('--port');
  if (cli && /^\d+$/.test(cli)) return Number(cli);
  const env = process.env.TJUAEUI_PORT ?? process.env.PORT;
  if (env && /^\d+$/.test(env)) return Number(env);
  return DEFAULT_PORT;
}

function resolveAllowRemote(): boolean {
  if (has('--remote')) return true;
  const host = process.env.TJUAEUI_HOST?.trim();
  if (host && ['0.0.0.0', '::', '::0'].includes(host)) return true;
  return parseBoolean(process.env.TJUAEUI_ALLOW_REMOTE ?? process.env.TJUAEUI_REMOTE);
}

function resolveStaticDir(): string {
  if (process.env.TJUAEUI_STATIC_DIR) return process.env.TJUAEUI_STATIC_DIR;
  const candidate = path.join(repoRoot, 'out', 'renderer');
  if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  throw new Error(`在 ${candidate} 未找到渲染资源。请先运行“bun run package”，或设置 TJUAEUI_STATIC_DIR。`);
}

/**
 * Rebuild renderer/main bundles before launching, so that `bun run webui` always
 * serves the latest source. Skipped when:
 *   --no-build flag           : explicit opt-out (e.g., iterating on this script)
 *   $TJUAEUI_NO_BUILD=1        : env-level opt-out
 *   $TJUAEUI_STATIC_DIR is set : caller is pointing us at a prebuilt artifact dir
 */
function runPackageIfNeeded(): void {
  if (has('--no-build')) return;
  if (parseBoolean(process.env.TJUAEUI_NO_BUILD)) return;
  if (process.env.TJUAEUI_STATIC_DIR) return;
  console.log('[webui] 正在运行“bun run package”刷新 out/renderer（可传 --no-build 跳过）……');
  const start = Date.now();
  execSync('bun run package', { cwd: repoRoot, stdio: 'inherit' });
  console.log(`[webui] 打包完成，耗时 ${((Date.now() - start) / 1000).toFixed(1)} 秒`);
}

function resolveBackendBinary(): string {
  if (process.env.TJUAEUI_BACKEND_BIN) return process.env.TJUAEUI_BACKEND_BIN;

  const bundledBase = process.env.TJUAEUI_BACKEND_BUNDLED_DIR ?? path.join(repoRoot, 'resources', 'bundled-tjuaecore');
  const runtimeKey = `${process.platform}-${process.arch}`;
  const bundled = path.join(bundledBase, runtimeKey, BACKEND_BINARY);
  if (fs.existsSync(bundled)) return bundled;

  try {
    const cmd = process.platform === 'win32' ? `where ${BACKEND_BINARY}` : `which ${BACKEND_BINARY}`;
    const found = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim().split(/\r?\n/)[0];
    if (found && fs.existsSync(found)) return found;
  } catch {
    // 继续尝试其他位置。
  }

  throw new Error(`未找到“${BACKEND_BINARY}”。请设置 TJUAEUI_BACKEND_BIN、将它加入 PATH，或放到 ${bundled}。`);
}

/**
 * 将 nvm 管理的全部 Node bin 目录前置到 PATH。Electron 主进程也执行此操作；
 * 否则安装在特定 Node 版本下的 CLI 可能无法被 ACP 启动的后端找到，最终导致
 * ACP 握手超时并向界面返回 502。
 */
function augmentPathWithNvm(): void {
  if (process.platform === 'win32') return;
  const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
  const versionsDir = path.join(nvmDir, 'versions', 'node');
  if (!fs.existsSync(versionsDir)) return;
  try {
    const versions = fs.readdirSync(versionsDir);
    const nvmBins = versions.map((v) => path.join(versionsDir, v, 'bin')).filter((p) => fs.existsSync(p));
    if (nvmBins.length === 0) return;
    const current = process.env.PATH || '';
    const missing = nvmBins.filter((p) => !current.split(path.delimiter).includes(p));
    if (missing.length > 0) {
      process.env.PATH = [...missing, current].join(path.delimiter);
    }
  } catch {
    // best-effort
  }
}

/**
 * Read the WebUI admin username from backend. Returns 'admin' as a best-effort
 * fallback — useful when the backend is unreachable or the SQLite users row
 * has not been seeded yet.
 */
async function fetchAdminUsername(backendPort: number): Promise<string> {
  try {
    const res = await fetch(`http://127.0.0.1:${backendPort}/api/auth/internal/users/system`);
    if (!res.ok) return 'admin';
    const json = (await res.json()) as { data?: { username?: string } };
    return json.data?.username || 'admin';
  } catch {
    return 'admin';
  }
}

async function main(): Promise<void> {
  augmentPathWithNvm();
  runPackageIfNeeded();
  const port = resolvePort();
  const allowRemote = resolveAllowRemote();
  const autoOpenBrowser = shouldAutoOpenBrowser({
    allowRemote,
    env: process.env,
    openFlag: has('--open'),
    noOpenFlag: has('--no-open'),
  });
  // One working dir for the whole standalone webui: backend SQLite and chat
  // history live here. Admin credentials live in the backend's users table.
  // This keeps `bun run webui` fully self-contained on hosts without TjuaeUI.app.
  const workDir = resolveBackendDataDir();
  const staticDir = resolveStaticDir();
  const backendBin = resolveBackendBinary();
  const logDir = process.env.TJUAEUI_LOG_DIR ?? path.join(workDir, 'logs');

  console.log('[webui] 工作目录：', workDir);
  console.log('[webui] 静态资源目录：', staticDir);
  console.log('[webui] 后端二进制文件：', backendBin);
  console.log(`[webui] 正在启动：端口=${port}，允许远程访问=${allowRemote}`);

  const handle = await startWebHost({
    app: {
      version: '0.0.0',
      isPackaged: false,
      resourcesPath: repoRoot,
      userDataPath: workDir,
    },
    staticDir,
    port,
    allowRemote,
    dataDir: workDir,
    logDir,
    // Surface the same work dir on /api/system/info so the browser UI shows
    // where standalone webui is actually persisting data. Without this the
    // backend inherits process.env and may report the parent shell's cwd.
    dirs: {
      cacheDir: workDir,
      workDir: workDir,
      logDir,
    },
    backend: {
      kind: 'ownBackend',
      resolveBackend: () => backendBin,
    },
  });

  console.log('');
  console.log('TjuaeUI WebUI 已就绪');
  console.log(`  本机地址：${handle.localUrl}`);
  if (handle.networkUrl) console.log(`  网络地址：${handle.networkUrl}`);

  // If SQLite has no admin yet (fresh install), seed one via backend and print
  // the plaintext credentials. Mirrors webuiBridge.ts:maybeSeedInitialPassword
  // for the Electron path — SQLite is now the single source of truth.
  //
  // Username is surfaced explicitly: legacy dev databases may have the seeded
  // user as `system` instead of `admin`, and Electron users can rename it via
  // Settings. Always read it from the backend rather than assuming a value.
  try {
    const statusRes = await fetch(`http://127.0.0.1:${handle.backendPort}/api/auth/status`);
    if (statusRes.ok) {
      const status = (await statusRes.json()) as { needs_setup?: boolean };
      if (status.needs_setup === true) {
        const resetRes = await fetch(`http://127.0.0.1:${handle.backendPort}/api/webui/reset-password`, {
          method: 'POST',
        });
        if (resetRes.ok) {
          const payload = (await resetRes.json()) as { data?: { new_password?: string } };
          const initialPassword = payload.data?.new_password;
          if (initialPassword) {
            const adminUsername = await fetchAdminUsername(handle.backendPort);
            console.log('');
            console.log(`初始管理员用户名：${adminUsername}`);
            console.log(`初始管理员密码：${initialPassword}`);
            console.log('（首次登录后请立即修改）');
          }
        }
      } else {
        // Credentials already exist; just remind the user what username to use.
        const adminUsername = await fetchAdminUsername(handle.backendPort);
        console.log('');
        console.log(`登录用户名：${adminUsername}`);
        console.log('（忘记密码时运行 `bun run resetpass` 生成新密码）');
      }
    }
  } catch (err) {
    console.warn('[webui] 无法查询管理员凭据：', err);
  }

  if (autoOpenBrowser) {
    const openResult = openBrowserUrl(handle.localUrl);
    if (openResult.ok) {
      console.log(`[webui] 已在浏览器中打开 ${handle.localUrl}`);
    } else {
      console.warn(`[webui] 无法自动打开浏览器：${openResult.reason}`);
    }
  }

  console.log('');
  console.log('按 Ctrl+C 停止。');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[webui] 收到 ${signal}，正在停止……`);
    try {
      await handle.stop();
    } catch (err) {
      console.error('[webui] 停止失败：', err);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[webui] 启动失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
